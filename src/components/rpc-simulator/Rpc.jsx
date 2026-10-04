import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { load, save } from '../../utils/storage';
import { toast } from '../../utils/toast';
import Segmented from '../ui/Segmented';
import BatchPanel from './BatchPanel';
import PopulationChart from './PopulationChart';
import {
	clampToBounds,
	COLOR,
	countTypes,
	createEntities,
	createEntity,
	EMOJI,
	getWinner,
	LABEL,
	RADIUS,
	step,
	TYPES,
} from './simulation';
import './rpc.css';

const DEFAULT_COUNT = 10;
const MAX_COUNT = 100;
const MAX_ENTITIES = 600;
const MAX_WIDTH = 800;
const MIN_SPEED = 0.25;
const MAX_SPEED = 8;
const MAX_FRAME_SECONDS = 1 / 30; // avoid huge jumps after the tab was in the background
const MAX_SAMPLES = 600; // chart history is halved whenever it reaches this
const PROPHET_STREAK = 3;

const BET_OPTIONS = [
	{ value: 'none', label: 'No bet' },
	...TYPES.map((type) => ({ value: type, label: `${EMOJI[type]} ${LABEL[type]}` })),
];
const BRUSH_OPTIONS = TYPES.map((type) => ({
	value: type,
	label: EMOJI[type],
	title: LABEL[type],
	ariaLabel: `Drop ${LABEL[type].toLowerCase()}`,
}));

function Rpc() {
	let wrapper;
	let canvas;
	let batchEntities = null; // the batch game on show while watching
	let ctx;
	let size = { width: MAX_WIDTH, height: 600 };
	let entities = [];
	let frame = 0;
	let lastTime = 0;

	// Chart history, sampled every `sampleEvery` seconds of simulated time
	let samples = [];
	let simTime = 0;
	let sampleEvery = 0.1;
	let nextSample = 0;
	const [samplesVersion, setSamplesVersion] = createSignal(0);

	const [count, setCount] = createSignal(DEFAULT_COUNT);
	const [speed, setSpeed] = createSignal(1);
	const [running, setRunning] = createSignal(false);
	const [roundStarted, setRoundStarted] = createSignal(false);
	const [finished, setFinished] = createSignal(false);
	const [counts, setCounts] = createSignal(countTypes([]));
	const [scores, setScores] = createSignal({ rock: 0, paper: 0, scissors: 0 });
	const [bet, setBet] = createSignal('none');
	const [meddled, setMeddled] = createSignal(false);
	const [streak, setStreak] = createSignal(0);
	const [bestStreak, setBestStreak] = createSignal(load('rpc-best-streak', 0));
	const [brush, setBrush] = createSignal('rock');
	const [watch, setWatch] = createSignal(null); // batch status while watching, else null
	const shownCounts = () => watch()?.counts ?? counts();

	const drawEntities = (list) => {
		if (!ctx) return;
		ctx.clearRect(0, 0, size.width, size.height);
		for (const e of list) ctx.fillText(EMOJI[e.type], e.x, e.y);
	};

	const draw = () => drawEntities(entities);

	const drawBatch = (list) => {
		batchEntities = list;
		drawEntities(list);
	};

	const watchChange = (state) => {
		const was = watch();
		setWatch(state);
		if (state && !was) {
			pause();
			wrapper.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
		} else if (!state && was) {
			batchEntities = null;
			draw();
		}
	};

	const recordSample = () => {
		samples.push({ t: simTime, ...countTypes(entities) });
		if (samples.length >= MAX_SAMPLES) {
			samples = samples.filter((_, i) => i % 2 === 0);
			sampleEvery *= 2;
		}
		nextSample = simTime + sampleEvery;
		setSamplesVersion((v) => v + 1);
	};

	const resize = () => {
		const width = Math.min(wrapper.clientWidth || MAX_WIDTH, MAX_WIDTH);
		const height = Math.round(Math.min(600, Math.max(380, width * 0.7)));
		const dpr = window.devicePixelRatio || 1;
		size = { width, height };
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.height = `${height}px`;
		if (ctx) {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.font = `${RADIUS * 2}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#e2e8f0'; // only shows if the system has no colour emoji font
		}
		clampToBounds(entities, width, height);
		drawEntities(batchEntities ?? entities);
	};

	const newBoard = () => {
		entities = createEntities(count(), size.width, size.height);
		samples = [];
		simTime = 0;
		sampleEvery = 0.1;
		setCounts(countTypes(entities));
		setFinished(false);
		setRoundStarted(false);
		setMeddled(false);
		recordSample();
		draw();
	};

	const watchMessage = () => {
		const { index, total, counts: c, holding, lastWinner } = watch();
		if (!holding) return `Simulation ${index} / ${total} · ${TYPES.map((t) => `${EMOJI[t]} ${c[t]}`).join(' ')}`;
		return lastWinner ? `${EMOJI[lastWinner]} ${LABEL[lastWinner]} wins game ${index}` : `Game ${index} ran out of time`;
	};

	const boardLabel = () => {
		const c = shownCounts();
		const state = watch();
		const prefix = state ? `Simulation game ${state.index} of ${state.total}` : 'Simulation';
		return `${prefix}: ${c.rock} rocks, ${c.paper} papers, ${c.scissors} scissors`;
	};

	const settleBet = (winner) => {
		const message = `${EMOJI[winner]} ${LABEL[winner]} wins!`;
		if (bet() === 'none') return toast(message);
		if (meddled()) return toast(`${message} You meddled, so the bet doesn't count.`, 'info');
		if (bet() !== winner) {
			setStreak(0);
			return toast(`${message} Your pick lost; streak reset.`, 'error');
		}
		setStreak((s) => s + 1);
		if (streak() > bestStreak()) {
			setBestStreak(streak());
			save('rpc-best-streak', streak());
		}
		toast(`${message} You called it! 🔥 Streak: ${streak()}`);
		const rect = canvas.getBoundingClientRect();
		confetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
		if (streak() >= PROPHET_STREAK) unlock('rpc-prophet');
	};

	const tick = (time) => {
		const dt = Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS) * speed();
		lastTime = time;
		step(entities, size.width, size.height, dt);
		simTime += dt;
		draw();

		const current = countTypes(entities);
		setCounts(current);
		if (simTime >= nextSample) recordSample();

		const winner = getWinner(current);
		if (winner) {
			recordSample();
			pause();
			setFinished(true);
			setRoundStarted(false);
			setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }));
			settleBet(winner);
			return;
		}
		frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (finished()) newBoard();
		setRunning(true);
		setRoundStarted(true);
		frame = requestAnimationFrame((time) => {
			lastTime = time;
			tick(time);
		});
	};

	function pause() {
		cancelAnimationFrame(frame);
		setRunning(false);
	}

	const reset = () => {
		pause();
		setSpeed(1);
		newBoard();
	};

	const changeSpeed = (factor) =>
		setSpeed((s) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, factor ? s * factor : 1)));

	const changeCount = (e) => {
		const value = parseInt(e.currentTarget.value, 10);
		if (Number.isNaN(value)) return;
		if (value > MAX_COUNT) toast(`The most you can have is ${MAX_COUNT} of each.`, 'error');
		const clamped = Math.min(MAX_COUNT, Math.max(1, value));
		e.currentTarget.value = clamped;
		setCount(clamped);
		newBoard();
	};

	// Clicking the board drops in a new piece of the selected type
	const drop = (e) => {
		if (watch()) return;
		if (entities.length >= MAX_ENTITIES) {
			toast(`The board is full (${MAX_ENTITIES} pieces).`, 'error');
			return;
		}
		const rect = canvas.getBoundingClientRect();
		entities.push(createEntity(brush(), e.clientX - rect.left, e.clientY - rect.top));
		clampToBounds(entities, size.width, size.height);
		if (roundStarted() && bet() !== 'none') setMeddled(true);
		const current = countTypes(entities);
		setCounts(current);
		// Dropping a different type onto a finished board brings it back to life
		if (finished() && !getWinner(current)) setFinished(false);
		recordSample();
		draw();
	};

	onMount(() => {
		document.title = 'RPC Simulator | Alfred Shaheen';
		ctx = canvas.getContext('2d');
		resize();
		newBoard();

		const observer = new ResizeObserver(resize);
		observer.observe(wrapper);
		onCleanup(() => observer.disconnect());
	});

	onCleanup(() => cancelAnimationFrame(frame));

	return (
		<section class="page rpc">
			<h1 class="page-title">Rock Paper Scissors Simulator</h1>

			<div class="rpc-stats">
				<p class="rpc-legend" aria-label="On the board">
					<For each={TYPES}>
						{(type) => (
							<span class="rpc-count">
								<span class="swatch" style={{ background: COLOR[type] }} />
								{EMOJI[type]} {LABEL[type]} <strong>{shownCounts()[type]}</strong>
							</span>
						)}
					</For>
				</p>
				<p>
					<span class="rpc-stats-label">Rounds won</span>
					<For each={TYPES}>
						{(type) => (
							<span class="rpc-count">
								{LABEL[type]}: {scores()[type]}
							</span>
						)}
					</For>
				</p>
			</div>

			<div class="rpc-controls">
				<button class="btn" disabled={!!watch()} onClick={() => (running() ? pause() : start())}>
					{running() ? 'Pause' : finished() ? 'New round' : roundStarted() ? 'Resume' : 'Start'}
				</button>
				<button class="btn btn-ghost" disabled={!!watch()} onClick={reset}>
					Reset
				</button>

				<div class="rpc-speed" role="group" aria-label="Speed">
					<button class="btn btn-ghost" onClick={() => changeSpeed(1 / 1.5)} aria-label="Decrease speed">
						−
					</button>
					<button class="btn btn-ghost rpc-speed-value" onClick={() => changeSpeed()} title="Reset speed">
						{speed().toFixed(2).replace(/\.?0+$/, '')}×
					</button>
					<button class="btn btn-ghost" onClick={() => changeSpeed(1.5)} aria-label="Increase speed">
						+
					</button>
				</div>

				<label class="rpc-count-input">
					Count per type
					<input
						type="number"
						min="1"
						max={MAX_COUNT}
						value={count()}
						disabled={running() || !!watch()}
						onChange={changeCount}
					/>
				</label>
			</div>

			<div class="rpc-controls rpc-fun">
				<div class="rpc-control-group">
					<span class="rpc-stats-label">Your pick</span>
					<Segmented label="Bet on a winner" options={BET_OPTIONS} value={bet()} onChange={setBet} disabled={roundStarted()} />
					<Show when={bet() !== 'none'}>
						<span class="rpc-streak" title={`Best streak: ${bestStreak()}`}>
							🔥 {streak()}
						</span>
					</Show>
				</div>
				<div class="rpc-control-group">
					<span class="rpc-stats-label">Click to drop</span>
					<Segmented label="Piece to drop" options={BRUSH_OPTIONS} value={brush()} onChange={setBrush} />
				</div>
			</div>

			<div class="rpc-board" ref={wrapper}>
				<canvas
					ref={canvas}
					role="img"
					aria-label={boardLabel()}
					onPointerDown={drop}
				/>
				<Show when={watch()}>
					<p class="rpc-board-overlay" aria-hidden="true">
						{watchMessage()}
					</p>
				</Show>
			</div>

			<div class="rpc-chart-wrap">
				<PopulationChart samples={() => samples} version={samplesVersion} />
			</div>

			<BatchPanel
				count={count}
				boardSize={() => size}
				onStart={pause}
				drawBoard={drawBatch}
				onWatchChange={watchChange}
			/>
		</section>
	);
}

export default Rpc;
