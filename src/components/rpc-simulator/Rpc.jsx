import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import { toast } from '../../utils/toast';
import Segmented from '../ui/Segmented';
import SoundToggle from '../ui/SoundToggle';
import BatchPanel from './BatchPanel';
import PopulationChart from './PopulationChart';
import PredictControls from './PredictControls';
import { emptyCurve, ORACLE_SCORE, presetCurve, scorePrediction } from './prediction';
import SandboxPanel from './SandboxPanel';
import { defaultSandbox, isCustom, normalizeSandbox, simOptions, startCounts } from './sandbox';
import { shareText } from './shareText';
import {
	advance,
	clampToBounds,
	countTypes,
	createEntities,
	createEntity,
	EMOJI,
	getRules,
	getWinner,
	LABEL,
	RADIUS,
	RULESETS,
} from './simulation';
import { createThrottle, POP_INTERVAL } from './throttle';
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

const RULES_OPTIONS = RULESETS.map((rules) => ({ value: rules.id, label: rules.name }));

function Rpc() {
	let wrapper;
	let canvas;
	let batchEntities = null; // the batch game on show while watching
	let ctx;
	let size = { width: MAX_WIDTH, height: 600 };
	let entities = [];
	let frame = 0;
	let lastTime = 0;
	const allowPop = createThrottle(POP_INTERVAL);

	// Chart history, sampled every `sampleEvery` seconds of simulated time
	let samples = [];
	let simTime = 0;
	let sampleEvery = 0.1;
	let nextSample = 0;
	const [samplesVersion, setSamplesVersion] = createSignal(0);
	const [simulatedSeconds, setSimulatedSeconds] = createSignal(0);
	const [portals, setPortals] = createSignal(false);
	const [portalUsed, setPortalUsed] = createSignal(false);
	const [teleports, setTeleports] = createSignal(0);
	let portalCooldown = new WeakMap();

	const [rulesId, setRulesId] = createSignal(getRules(load('rpc-rules', 'classic')).id);
	const [sandbox, setSandbox] = createSignal(normalizeSandbox(load('rpc-sandbox', null)));
	const [count, setCount] = createSignal(DEFAULT_COUNT);
	const [speed, setSpeed] = createSignal(1);
	const [running, setRunning] = createSignal(false);
	const [roundStarted, setRoundStarted] = createSignal(false);
	const [finished, setFinished] = createSignal(false);
	const [counts, setCounts] = createSignal(countTypes([]));
	const [scores, setScores] = createSignal({ rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 });
	const [bet, setBet] = createSignal('none');
	const [meddled, setMeddled] = createSignal(false);
	const [streak, setStreak] = createSignal(0);
	const [bestStreak, setBestStreak] = createSignal(load('rpc-best-streak', 0));
	const [brush, setBrush] = createSignal('rock');
	const [watch, setWatch] = createSignal(null); // batch status while watching, else null
	const [predictOpen, setPredictOpen] = createSignal(false);
	const [predictType, setPredictType] = createSignal('rock');
	const [prediction, setPrediction] = createSignal({}); // { type: curve }, see prediction.js
	const [result, setResult] = createSignal(null); // { score, accuracy } for the last round's prediction
	const [revived, setRevived] = createSignal(false); // dropped onto a finished board to carry on
	const [batchRunning, setBatchRunning] = createSignal(false);
	const [sandboxOpen, setSandboxOpen] = createSignal(false);
	const [outcome, setOutcome] = createSignal(null); // what the last round came to, for sharing
	const rules = () => getRules(rulesId());
	const types = () => rules().types;
	// A batch being watched brings its own rules, which may not be the page's
	const shownRules = () => watch()?.rules ?? rules();
	const shownCounts = () => watch()?.counts ?? counts();
	const roundCounts = () => startCounts(sandbox(), rules(), count());
	const custom = () => isCustom(sandbox(), rules(), count());
	const simulation = () => ({ rules: rules(), ...simOptions(sandbox()) });
	const predictState = () => (finished() ? 'done' : roundStarted() || revived() ? 'locked' : 'idle');

	const betOptions = () => [
		{ value: 'none', label: 'No bet' },
		// Five names don't fit in a row on a phone
		...types().map((type) =>
			types().length > 3
				? { value: type, label: EMOJI[type], title: LABEL[type], ariaLabel: `Bet on ${LABEL[type].toLowerCase()}` }
				: { value: type, label: `${EMOJI[type]} ${LABEL[type]}` },
		),
	];
	const brushOptions = () =>
		types().map((type) => ({
			value: type,
			label: EMOJI[type],
			title: LABEL[type],
			ariaLabel: `Drop ${LABEL[type].toLowerCase()}`,
		}));

	const portalPoints = () => [{ x: size.width * 0.25, y: size.height * 0.52 }, { x: size.width * 0.75, y: size.height * 0.52 }];
	const portalRadius = () => Math.max(RADIUS * 1.8, Math.min(size.width, size.height) * 0.065);
	const drawPortals = () => {
		if (!portals() || watch() || !ctx) return;
		ctx.save();
		portalPoints().forEach((point, i) => {
			ctx.beginPath(); ctx.arc(point.x, point.y, portalRadius(), 0, Math.PI * 2);
			ctx.fillStyle = i ? '#a78bfa22' : '#4fd1c522'; ctx.fill();
			ctx.strokeStyle = i ? '#c4b5fd' : '#4fd1c5'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.stroke();
			ctx.font = 'bold 13px system-ui'; ctx.fillStyle = i ? '#c4b5fd' : '#4fd1c5'; ctx.fillText(i ? 'B' : 'A', point.x, point.y);
		}); ctx.restore();
	};
	const teleport = () => {
		if (!portals()) return;
		const points = portalPoints(), radius = portalRadius(); let moved = 0;
		for (const entity of entities) {
			if ((portalCooldown.get(entity) || 0) > simTime) continue;
			const entered = points.findIndex(point => Math.hypot(entity.x - point.x, entity.y - point.y) <= radius * 0.72);
			if (entered < 0) continue;
			const exit = points[1 - entered], speed = Math.hypot(entity.vx, entity.vy) || 1;
			entity.x = exit.x + (entity.vx / speed) * (radius + RADIUS);
			entity.y = exit.y + (entity.vy / speed) * (radius + RADIUS);
			portalCooldown.set(entity, simTime + 0.8); moved++;
		}
		if (moved) setTeleports(value => value + moved);
		clampToBounds(entities, size.width, size.height);
	};
	const togglePortals = () => {
		setPortals(value => !value);
		if (roundStarted()) { setMeddled(true); setPortalUsed(true); }
		draw();
	};
	const drawEntities = (list) => {
		if (!ctx) return;
		ctx.clearRect(0, 0, size.width, size.height);
		drawPortals();
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
		samples.push({ t: simTime, ...countTypes(entities, rules()) });
		if (samples.length >= MAX_SAMPLES) {
			samples = samples.filter((_, i) => i % 2 === 0);
			sampleEvery *= 2;
		}
		nextSample = simTime + sampleEvery;
		setSamplesVersion((v) => v + 1);
	};

	const resize = () => {
		const width = Math.min(wrapper.clientWidth || MAX_WIDTH, MAX_WIDTH);
		const height = Math.round(Math.min(600, Math.max(320, width * 0.6)));
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
		entities = createEntities(roundCounts(), size.width, size.height, Math.random, rules());
		samples = [];
		simTime = 0;
		setSimulatedSeconds(0);
		setTeleports(0); setPortalUsed(false); portalCooldown = new WeakMap();
		sampleEvery = 0.1;
		setCounts(countTypes(entities, rules()));
		setFinished(false);
		setRoundStarted(false);
		setResult(null);
		setMeddled(false);
		setRevived(false);
		recordSample();
		draw();
	};

	const watchMessage = () => {
		const { index, total, counts: c, holding, lastWinner } = watch();
		if (!holding) return `Simulation ${index} / ${total} · ${shownRules().types.map((t) => `${EMOJI[t]} ${c[t]}`).join(' ')}`;
		return lastWinner ? `${EMOJI[lastWinner]} ${LABEL[lastWinner]} wins game ${index}` : `Game ${index} ran out of time`;
	};

	const boardLabel = () => {
		const c = shownCounts();
		const state = watch();
		const prefix = state ? `Simulation game ${state.index} of ${state.total}` : 'Simulation';
		return `${prefix}: ${shownRules().types.map((type) => `${c[type]} ${shownRules().plural[type]}`).join(', ')}`;
	};

	const settleBet = (winner) => {
		const message = `${EMOJI[winner]} ${LABEL[winner]} wins!`;
		if (bet() === 'none') {
			playSound('win');
			return toast(message);
		}
		if (meddled() || portalUsed()) {
			playSound('win');
			return toast(`${message} Experimental round, so the bet doesn't count.`, 'info');
		}
		if (bet() !== winner) {
			playSound('lose');
			setStreak(0);
			return toast(`${message} Your pick lost; streak reset.`, 'error');
		}
		playSound('win');
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

	const advanceRound = (dt, time = performance.now()) => {
		const converted = advance(entities, size.width, size.height, dt, simulation());
		simTime += dt;
		if (portals()) { setPortalUsed(true); teleport(); }
		setSimulatedSeconds(simTime);
		draw();
		if (converted > 0 && allowPop(time)) playSound('pop');

		const current = countTypes(entities, rules());
		setCounts(current);
		if (simTime >= nextSample) recordSample();

		const winner = getWinner(current);
		if (winner) {
			recordSample();
			pause();
			setFinished(true);
			setRoundStarted(false);
			setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }));
			// A board brought back to life has already shown how the round went, so it can't be predicted
			const scored = revived() || portalUsed() ? null : scorePrediction(prediction(), samples, types());
			setResult(scored && { score: scored.score, accuracy: scored.accuracy });
			setOutcome({
				winner,
				seconds: simTime,
				rules: rules(),
				custom: custom(),
				called: bet() === winner && !meddled() && !portalUsed(),
				score: scored?.score ?? null,
			});
			settleBet(winner);
			if (scored && scored.score >= ORACLE_SCORE) unlock('rpc-oracle');
			// Settings can be changed mid-round, so check again at the end
			if (custom()) unlock('rpc-mad-scientist');
			return true;
		}
		return false;
	};

	const tick = (time) => {
		const dt = Math.max(0, Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS)) * speed();
		lastTime = time;
		if (!advanceRound(dt, time) && running()) frame = requestAnimationFrame(tick);
	};
	const stepOnce = () => {
		if (running() || finished() || watch() || batchRunning()) return;
		setPredictOpen(false);
		setRoundStarted(true);
		if (rules().id !== 'classic') unlock('rpc-lizard-spock');
		if (custom()) unlock('rpc-mad-scientist');
		advanceRound(0.1);
	};

	const start = () => {
		if (running() || watch()) return;
		if (finished()) {
			newBoard();
			setPrediction({});
		}
		setPredictOpen(false);
		if (rules().id !== 'classic') unlock('rpc-lizard-spock');
		if (custom()) unlock('rpc-mad-scientist');
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
		setPrediction({});
		setPredictOpen(false);
		newBoard();
	};

	const changeRules = (id) => {
		pause();
		setRulesId(id);
		save('rpc-rules', id);
		setScores((prev) => Object.fromEntries(Object.keys(prev).map((type) => [type, 0])));
		setPrediction({});
		setPredictOpen(false);
		setPredictType(types()[0]);
		if (!types().includes(brush())) setBrush(types()[0]);
		if (bet() !== 'none' && !types().includes(bet())) setBet('none');
		newBoard();
	};

	// Speed and radius take hold straight away, which counts as meddling with a bet. Starting counts need a
	// new board, so they're locked once a round has started, and only change the board while there isn't one.
	const changeSandbox = (next) => {
		const before = JSON.stringify(roundCounts());
		setSandbox(next);
		save('rpc-sandbox', next);
		if (roundStarted() && bet() !== 'none') setMeddled(true);
		if (!roundStarted() && JSON.stringify(roundCounts()) !== before) newBoard();
	};

	// Mid-round, the starting counts stay as they are for the board that's already in play
	const resetSandbox = () => {
		const fresh = defaultSandbox();
		changeSandbox(roundStarted() ? { ...fresh, counts: sandbox().counts } : fresh);
	};

	const togglePredict = () => {
		// Predicting after a round ends means starting a fresh one
		if (finished()) {
			newBoard();
			setPrediction({});
			setPredictOpen(true);
			return;
		}
		setPredictOpen((open) => !open);
	};

	const sketch = (type, curve) => setPrediction((prev) => ({ ...prev, [type]: curve }));
	const sketchPreset = (type, kind) => sketch(type, presetCurve(kind, 1 / types().length));

	const share = () => {
		const last = outcome();
		if (last) shareResult(`${shareText(last)}\n${location.origin}/rpc-simulator`);
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
		const current = countTypes(entities, rules());
		setCounts(current);
		// Dropping a different type onto a finished board brings it back to life. That round is already
		// decided, so a bet or prediction on it no longer counts.
		if (finished() && !getWinner(current)) {
			setFinished(false);
			setResult(null);
			setRevived(true);
			setMeddled(true);
		}
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
					<For each={shownRules().types}>
						{(type) => (
							<span class="rpc-count">
								<span class="swatch" style={{ background: shownRules().color[type] }} />
								{EMOJI[type]} {LABEL[type]} <strong>{shownCounts()[type]}</strong>
							</span>
						)}
					</For>
				</p>
				<p>
					<span class="rpc-stats-label">Rounds won</span>
					<For each={types()}>
						{(type) => (
							<span class="rpc-count">
								{LABEL[type]}: {scores()[type]}
							</span>
						)}
					</For>
				</p>
			</div>

			<div class="rpc-controls rpc-actions">
				<button class="btn" disabled={!!watch()} onClick={() => (running() ? pause() : start())}>
					{running() ? 'Pause' : finished() ? 'New round' : roundStarted() ? 'Resume' : 'Start'}
				</button>
				<button class="btn btn-ghost" disabled={!!watch()} onClick={reset}>
					Reset
				</button>
				<button class="btn btn-ghost" onClick={stepOnce} disabled={running() || finished() || Boolean(watch()) || batchRunning()} title="Advance 0.1 simulated seconds while paused. This starts the round and locks predictions.">Step +0.1s</button>
				<output class="rpc-step-clock" aria-label="Simulated time">{simulatedSeconds().toFixed(1)}s simulated</output>
				<SoundToggle />
				<Show when={finished() && outcome()}>
					<button class="btn btn-ghost" onClick={share}>
						Share
					</button>
				</Show>

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

				<span class="rpc-sandbox-toggle">
					<button
						type="button"
						class="btn btn-ghost"
						aria-expanded={sandboxOpen()}
						aria-controls="rpc-sandbox"
						onClick={() => setSandboxOpen((open) => !open)}
					>
						Sandbox
					</button>
					<Show when={custom()}>
						<span class="rpc-badge">Custom rules</span>
					</Show>
				</span>
			</div>

			<div class="rpc-controls rpc-fun">
				<Segmented
					label="Rules"
					options={RULES_OPTIONS}
					value={rulesId()}
					onChange={changeRules}
					disabled={running() || !!watch() || batchRunning()}
				/>
				<div class="rpc-control-group">
					<span class="rpc-stats-label">Bet</span>
					<Segmented label="Bet on a winner" options={betOptions()} value={bet()} onChange={setBet} disabled={roundStarted()} />
					<Show when={bet() !== 'none'}>
						<span class="rpc-streak" title={`Best streak: ${bestStreak()}`}>
							🔥 {streak()}
						</span>
					</Show>
				</div>
				<div class="rpc-control-group">
					<span class="rpc-stats-label">Drop</span>
					<Segmented label="Piece to drop" options={brushOptions()} value={brush()} onChange={setBrush} />
				</div>
			</div>

			<div class="rpc-portal-tools"><button class="btn btn-ghost" aria-pressed={portals()} onClick={togglePortals} disabled={Boolean(watch()) || batchRunning()}>{portals() ? '◉ Portals on' : '◎ Enable portals'}</button><p role="status">{portals() ? `${teleports()} wormhole jumps · Enter A, emerge at B. Experimental rounds don’t score bets or predictions.` : 'Add a pair of wormholes and let the arena bend space.'}</p></div>
			<SandboxPanel
				open={sandboxOpen}
				rules={rules}
				sandbox={sandbox}
				count={count}
				custom={custom}
				lockCounts={() => roundStarted() || running() || !!watch()}
				onChange={changeSandbox}
				onReset={resetSandbox}
			/>

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
				<PopulationChart
					samples={() => samples}
					version={samplesVersion}
					rules={rules}
					predicting={() => predictOpen() && predictState() === 'idle'}
					predictType={predictType}
					prediction={prediction}
					showPrediction={() => finished() && result() !== null}
					onSketch={sketch}
					actions={
						<PredictControls
							rules={rules}
							state={predictState}
							active={predictOpen}
							type={predictType}
							prediction={prediction}
							result={result}
							onType={setPredictType}
							onToggle={togglePredict}
							onClear={(type) => sketch(type, emptyCurve())}
							onPreset={sketchPreset}
						/>
					}
				/>
			</div>

			<BatchPanel
				count={roundCounts}
				rules={rules}
				sim={() => simOptions(sandbox())}
				custom={custom}
				boardSize={() => size}
				onStart={pause}
				drawBoard={drawBatch}
				onWatchChange={watchChange}
				onRunningChange={setBatchRunning}
			/>
		</section>
	);
}

export default Rpc;
