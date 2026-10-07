import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { toast } from '../../utils/toast';
import Segmented from '../ui/Segmented';
import { BATCH_DT, createGame, insights, MAX_RUNS, summarize } from './batch';
import { CLASSIC, countTypes, EMOJI } from './simulation';

const DEFAULT_RUNS = 20;
const DEFAULT_SPEED = 4;
const FRAME_BUDGET = 12; // ms of simulating per animation frame
const STEPS_PER_CALL = 50;
const MAX_FRAME_SECONDS = 1 / 30; // avoid huge jumps after the tab was in the background
const HOLD_MS = 700; // how long a finished game stays on the board when watching
const MAX_HOLD_SPEED = 4; // faster than this and the pause would drag, so skip it

const LARGE_GAME = 300; // pieces per game, above which a big batch takes minutes

const SPEED_OPTIONS = [1, 4, 16, 64].map((value) => ({ value, label: `${value}×` }));

const seconds = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}s` : '–');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const emoji = (type) => (type ? EMOJI[type] : '–');

// Runs lots of headless games in the background and summarises who tends to win.
// `count()` is pieces per type (a number, or { type: n }), `boardSize()` is { width, height }, `onStart` fires when a batch begins.
// Optional: `rules()` (default classic), `sim()` ({ radius, speed } from the sandbox) and `custom()`,
// true when the sandbox isn't at its defaults, so the results can say what they were played under.
// When watching, `drawBoard(entities)` paints each frame and `onWatchChange(state)` gets
// { index, total, counts, holding, lastWinner, rules }, or null when nothing is being watched.
// `onRunningChange(running)` says when a batch starts and stops, so the page can lock what it must not change meanwhile.
function BatchPanel(props) {
	let frame = 0;
	let records = [];
	let reporting = false;
	let played = { rules: CLASSIC, custom: false }; // what the batch on screen was run under

	const [runs, setRuns] = createSignal(DEFAULT_RUNS);
	const [running, setRunning] = createSignal(false);
	const [progress, setProgress] = createSignal({ done: 0, total: 0 });
	const [result, setResult] = createSignal(null); // { records, partial }
	const [watching, setWatching] = createSignal(false);
	const [speed, setSpeed] = createSignal(DEFAULT_SPEED);
	createEffect(() => props.onRunningChange?.(running()));
	const summary = createMemo(() => (result() ? summarize(result().records, result().rules) : null));

	const report = (state) => {
		reporting = true;
		props.onWatchChange?.(state);
	};

	const clearReport = () => {
		if (!reporting) return;
		reporting = false;
		props.onWatchChange?.(null);
	};

	const stop = () => {
		cancelAnimationFrame(frame);
		setRunning(false);
		clearReport();
	};

	// Keep whatever finished, but only if something did
	const cancel = () => {
		stop();
		setResult(records.length ? { records: [...records], partial: true, ...played } : null);
	};

	const changeRuns = (e) => {
		const value = parseInt(e.currentTarget.value, 10);
		if (Number.isNaN(value)) return;
		if (value > MAX_RUNS) toast(`The most you can run at once is ${MAX_RUNS}.`, 'error');
		const clamped = Math.min(MAX_RUNS, Math.max(1, value));
		e.currentTarget.value = clamped;
		setRuns(clamped);
	};

	const run = () => {
		props.onStart?.();
		stop();
		const total = runs();
		const { width, height } = props.boardSize();
		const rules = props.rules?.() ?? CLASSIC;
		played = { rules, custom: props.custom?.() ?? false };
		const options = { countPerType: props.count(), width, height, ...(props.rules && { rules }), ...props.sim?.() };
		records = [];
		let game = createGame(options);
		let last = null; // time of the previous frame
		let carry = 0; // fractional steps left over from the previous frame
		let held = null; // { record, until } while a finished game stays on the board

		setResult(null);
		setProgress({ done: 0, total });
		setRunning(true);

		// True once the last game is in
		const commit = (record) => {
			records.push(record);
			if (records.length === total) {
				setResult({ records, partial: false, ...played });
				setRunning(false);
				clearReport();
				if (total >= MAX_RUNS) unlock('rpc-statistician');
				return true;
			}
			game = createGame(options);
			carry = 0;
			return false;
		};

		const headlessFrame = () => {
			const deadline = performance.now() + FRAME_BUDGET;
			do {
				const record = game.advance(STEPS_PER_CALL);
				if (record && commit(record)) return true;
			} while (performance.now() < deadline);
			return false;
		};

		const watchFrame = (time, elapsed) => {
			if (held && time >= held.until) {
				const { record } = held;
				held = null;
				if (commit(record)) return true;
			}
			if (!held) {
				carry += (speed() * Math.min(elapsed, MAX_FRAME_SECONDS)) / BATCH_DT;
				const steps = Math.floor(carry);
				carry -= steps;
				const record = steps > 0 ? game.advance(steps) : null;
				if (record) {
					if (speed() <= MAX_HOLD_SPEED) held = { record, until: time + HOLD_MS };
					else if (commit(record)) return true;
				}
			}
			props.drawBoard?.(game.entities);
			report({
				index: records.length + 1,
				total,
				counts: countTypes(game.entities, rules),
				rules,
				holding: !!held,
				lastWinner: held?.record.winner ?? null,
			});
			return false;
		};

		const tick = (time) => {
			const elapsed = last === null ? 0 : (time - last) / 1000;
			last = time;
			if (watching()) {
				if (watchFrame(time, elapsed)) return;
			} else {
				clearReport();
				if (held) {
					const { record } = held;
					held = null;
					if (commit(record)) return;
				}
				if (headlessFrame()) return;
			}
			setProgress({ done: records.length, total });
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	};

	onCleanup(stop);

	// e.g. "Lizard-Spock rules and custom sandbox settings", or null for a plain classic game
	const playedUnder = () => {
		const { rules, custom } = result();
		// Classic is only worth saying when the page is showing something else now
		const showRules = rules.id !== 'classic' || (props.rules && props.rules() !== rules);
		const parts = [showRules && `${rules.name} rules`, custom && 'custom sandbox settings'].filter(Boolean);
		return parts.length ? parts.join(' and ') : null;
	};

	// Pieces in each game of the next batch
	const pieces = () => {
		const each = props.count();
		return typeof each === 'number' ? each * (props.rules?.().types.length ?? 3) : Object.values(each).reduce((a, b) => a + b, 0);
	};

	const percent = (type) => Math.round((summary().winRate[type] || 0) * 100);

	return (
		<section class="rpc-batch" aria-labelledby="rpc-batch-title">
			<h2 id="rpc-batch-title" class="rpc-batch-title">
				Simulate many
			</h2>

			<div class="rpc-batch-controls">
				<label class="rpc-count-input">
					Simulations
					<input type="number" min="1" max={MAX_RUNS} value={runs()} disabled={running()} onChange={changeRuns} />
				</label>
				<Show
					when={running()}
					fallback={
						<button class="btn" onClick={run}>
							Run
						</button>
					}
				>
					<button class="btn btn-ghost" onClick={cancel}>
						Cancel
					</button>
				</Show>
			</div>

			<div class="rpc-batch-controls">
				<label class="rpc-batch-watch">
					<input type="checkbox" checked={watching()} onChange={(e) => setWatching(e.currentTarget.checked)} />
					Watch the games
				</label>
				<Show when={watching()}>
					<div class="rpc-batch-speed">
						<span class="rpc-stats-label">Speed</span>
						<Segmented label="Watch speed" options={SPEED_OPTIONS} value={speed()} onChange={setSpeed} />
					</div>
				</Show>
			</div>

			<Show when={pieces() > LARGE_GAME && !running()}>
				<p class="rpc-batch-warning" role="note">
					{pieces()} pieces per game is a lot. Every game is slow to settle, so a batch this size can take minutes. Fewer per type gets you an answer sooner.
				</p>
			</Show>

			<Show when={running()}>
				<div class="rpc-batch-progress">
					<div
						class="rpc-batch-track"
						role="progressbar"
						aria-label="Simulation progress"
						aria-valuemin="0"
						aria-valuemax={progress().total}
						aria-valuenow={progress().done}
					>
						<span style={{ width: `${(progress().done / progress().total) * 100}%` }} />
					</div>
					<p>
						Simulating {progress().done} / {progress().total}…
					</p>
				</div>
			</Show>

			<Show when={summary()}>
				{(s) => (
					<div class="rpc-batch-results" aria-live="polite">
						<p class="rpc-batch-note">
							{result().partial
								? `Partial results: ${plural(s().runs, 'run')} finished before you cancelled.`
								: `Results from ${plural(s().runs, 'run')}.`}
						</p>
						<Show when={playedUnder()}>
							<p class="rpc-batch-note">
								<Show when={result().custom}>
									<span class="rpc-badge">Custom rules</span>
								</Show>
								Played with {playedUnder()}.
							</p>
						</Show>

						<ul class="rpc-batch-bars" aria-label="Win share">
							<For each={result().rules.types}>
								{(type) => (
									<li classList={{ leader: s().leader === type }}>
										<span class="rpc-batch-name">
											{EMOJI[type]} {result().rules.label[type]}
										</span>
										<span class="rpc-batch-bar">
											<span style={{ width: `${percent(type)}%`, background: result().rules.color[type] }} />
										</span>
										<span class="rpc-batch-value">
											{plural(s().wins[type], 'win')} · {percent(type)}%
										</span>
									</li>
								)}
							</For>
						</ul>

						<dl class="rpc-batch-tiles">
							<div>
								<dt>Avg length</dt>
								<dd>{seconds(s().duration.mean)}</dd>
							</div>
							<div>
								<dt>Fastest</dt>
								<dd>
									{s().fastest ? `${seconds(s().fastest.duration)} ${emoji(s().fastest.winner)}` : '–'}
								</dd>
							</div>
							<div>
								<dt>Slowest</dt>
								<dd>
									{s().slowest ? `${seconds(s().slowest.duration)} ${emoji(s().slowest.winner)}` : '–'}
								</dd>
							</div>
							<div>
								<dt>Avg lead changes</dt>
								<dd>{s().avgLeadChanges.toFixed(1)}</dd>
							</div>
							<div>
								<dt>Comebacks</dt>
								<dd>{s().comebacks}</dd>
							</div>
							<Show when={s().draws > 0}>
								<div>
									<dt>Draws</dt>
									<dd>{s().draws}</dd>
								</div>
							</Show>
						</dl>

						<div class="rpc-batch-insights">
							<h3 class="rpc-stats-label">Insights</h3>
							<ul>
								<For each={insights(s())}>{(line) => <li>{line}</li>}</For>
							</ul>
						</div>

						<details class="rpc-batch-runs">
							<summary>Every run</summary>
							<div class="rpc-batch-table">
								<table>
									<thead>
										<tr>
											<th scope="col">#</th>
											<th scope="col">Winner</th>
											<th scope="col">Length</th>
											<th scope="col">First out</th>
											<th scope="col">Halfway leader</th>
											<th scope="col">Winner's low point</th>
										</tr>
									</thead>
									<tbody>
										<For each={result().records}>
											{(record, i) => (
												<tr>
													<td>{i() + 1}</td>
													<td>{record.winner ? emoji(record.winner) : 'Draw'}</td>
													<td>{seconds(record.duration)}</td>
													<td>{emoji(record.firstEliminated)}</td>
													<td>{emoji(record.leaderAtHalf)}</td>
													<td>{record.winnerMin ?? '–'}</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</details>
					</div>
				)}
			</Show>
		</section>
	);
}

export default BatchPanel;
