import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { toast } from '../../utils/toast';
import { createGame, insights, MAX_RUNS, summarize } from './batch';
import { COLOR, EMOJI, LABEL, TYPES } from './simulation';

const DEFAULT_RUNS = 20;
const FRAME_BUDGET = 12; // ms of simulating per animation frame
const STEPS_PER_CALL = 50;

const seconds = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}s` : '–');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const emoji = (type) => (type ? EMOJI[type] : '–');

// Runs lots of headless games in the background and summarises who tends to win.
// `count()` is pieces per type, `boardSize()` is { width, height }, `onStart` fires when a batch begins.
function BatchPanel(props) {
	let frame = 0;
	let records = [];

	const [runs, setRuns] = createSignal(DEFAULT_RUNS);
	const [running, setRunning] = createSignal(false);
	const [progress, setProgress] = createSignal({ done: 0, total: 0 });
	const [result, setResult] = createSignal(null); // { records, partial }
	const summary = createMemo(() => (result() ? summarize(result().records) : null));

	const stop = () => {
		cancelAnimationFrame(frame);
		setRunning(false);
	};

	// Keep whatever finished, but only if something did
	const cancel = () => {
		stop();
		setResult(records.length ? { records: [...records], partial: true } : null);
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
		const options = { countPerType: props.count(), width, height };
		records = [];
		let game = createGame(options);

		setResult(null);
		setProgress({ done: 0, total });
		setRunning(true);

		const tick = () => {
			const deadline = performance.now() + FRAME_BUDGET;
			do {
				const record = game.advance(STEPS_PER_CALL);
				if (!record) continue;
				records.push(record);
				if (records.length === total) {
					setResult({ records, partial: false });
					setRunning(false);
					if (total >= MAX_RUNS) unlock('rpc-statistician');
					return;
				}
				game = createGame(options);
			} while (performance.now() < deadline);
			setProgress({ done: records.length, total });
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	};

	onCleanup(stop);

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

						<ul class="rpc-batch-bars" aria-label="Win share">
							<For each={TYPES}>
								{(type) => (
									<li classList={{ leader: s().leader === type }}>
										<span class="rpc-batch-name">
											{EMOJI[type]} {LABEL[type]}
										</span>
										<span class="rpc-batch-bar">
											<span style={{ width: `${percent(type)}%`, background: COLOR[type] }} />
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
