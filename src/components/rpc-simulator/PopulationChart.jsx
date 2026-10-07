import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { spreadLabels } from './chartLayout';
import { completeCurve, emptyCurve, paintCurve, POINTS } from './prediction';
import { CLASSIC, EMOJI, LABEL } from './simulation';

const HEIGHT = 150;
const PAD = { top: 12, right: 40, bottom: 22, left: 32 };
const LABEL_GAP = 15; // minimum vertical space between end-of-line labels
const AXIS_TEXT = '#a3b1c6';
const GRID = 'rgba(226, 232, 240, 0.1)';
const SURFACE = '#1f2738';

// Index of the sample closest to time `t` (samples are sorted by t)
function nearestIndex(samples, t) {
	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (samples[mid].t < t) lo = mid + 1;
		else hi = mid;
	}
	if (lo > 0 && t - samples[lo - 1].t < samples[lo].t - t) lo--;
	return lo;
}

// Live line chart of each type's population over simulated time.
// `samples()` returns [{ t, [type]: count }]; `version()` changes whenever it grows.
// Optional: `rules()`, and for predictions `predicting()` (the chart becomes a sketch pad for
// `predictType()`, calling `onSketch(type, curve)`), `prediction()` ({ type: curve }, see prediction.js),
// `showPrediction()` (lay it over the real curves, dashed) and `actions` (extra header content).
function PopulationChart(props) {
	let wrapper;
	let canvas;
	let ctx;
	let width = 0;
	let drawing = null; // last { x, y } of a sketch stroke in progress
	const [pointerX, setPointerX] = createSignal(null); // px within the canvas, while hovering

	const rules = () => props.rules?.() ?? CLASSIC;
	const types = () => rules().types;
	const total = (sample) => types().reduce((sum, type) => sum + (sample[type] ?? 0), 0);

	const scales = (samples) => {
		const tMax = Math.max(samples.at(-1)?.t ?? 0, 1);
		const yMax = Math.max(1, ...samples.map(total));
		const plotW = width - PAD.left - PAD.right;
		const plotH = HEIGHT - PAD.top - PAD.bottom;
		return {
			tMax,
			yMax,
			x: (t) => PAD.left + (t / tMax) * plotW,
			y: (v) => PAD.top + plotH - (v / yMax) * plotH,
		};
	};

	// The sample under the pointer. Stored as a position rather than an index so the
	// crosshair stays under the cursor while live data keeps arriving.
	const hoveredIndex = (samples) => {
		const px = pointerX();
		if (px === null || samples.length === 0) return null;
		const { tMax } = scales(samples);
		const t = ((px - PAD.left) / (width - PAD.left - PAD.right)) * tMax;
		return nearestIndex(samples, Math.max(0, Math.min(tMax, t)));
	};

	// Draws a prediction curve (see prediction.js), skipping any stretch that wasn't drawn
	const drawCurve = (curve, { y }, yMax) => {
		const plotW = width - PAD.left - PAD.right;
		let pen = false;
		ctx.beginPath();
		curve.forEach((value, i) => {
			if (value === null) {
				pen = false;
				return;
			}
			const px = PAD.left + (i / (curve.length - 1)) * plotW;
			if (pen) ctx.lineTo(px, y(value * yMax));
			else ctx.moveTo(px, y(value * yMax));
			pen = true;
		});
		ctx.stroke();
	};

	const drawSketches = (scale, yMax) => {
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		for (const type of types()) {
			const curve = props.prediction?.()[type];
			if (!curve) continue;
			ctx.strokeStyle = rules().color[type];
			ctx.lineWidth = type === props.predictType?.() ? 3 : 2;
			drawCurve(curve, scale, yMax);
		}
	};

	const draw = () => {
		if (!ctx || !width) return;
		const samples = props.samples();
		const predicting = props.predicting?.();
		const scale = scales(samples);
		const { tMax, y } = scale;
		// While sketching, the scale is the starting population: nothing else is known yet
		const yMax = predicting ? Math.max(1, total(samples[0] ?? {})) : scale.yMax;

		ctx.clearRect(0, 0, width, HEIGHT);
		ctx.font = '11px Inter, system-ui, sans-serif';
		ctx.textBaseline = 'middle';

		// Recessive grid: baseline and a top line labelled with the maximum
		ctx.strokeStyle = GRID;
		ctx.lineWidth = 1;
		for (const v of [0, yMax]) {
			ctx.beginPath();
			ctx.moveTo(PAD.left, Math.round(y(v)) + 0.5);
			ctx.lineTo(width - PAD.right, Math.round(y(v)) + 0.5);
			ctx.stroke();
		}
		ctx.fillStyle = AXIS_TEXT;
		ctx.textAlign = 'right';
		ctx.fillText(String(yMax), PAD.left - 6, y(yMax));
		ctx.fillText('0', PAD.left - 6, y(0));
		ctx.textAlign = 'left';
		ctx.fillText(predicting ? 'Start' : '0s', PAD.left, HEIGHT - 8);
		ctx.textAlign = 'right';
		ctx.fillText(predicting ? 'End of round' : `${tMax.toFixed(tMax < 10 ? 1 : 0)}s`, width - PAD.right, HEIGHT - 8);

		// The round hasn't happened yet, so there's nothing to plot but the sketch
		if (predicting) {
			drawSketches(scale, yMax);
			if (!Object.values(props.prediction?.() ?? {}).some((curve) => curve?.some((v) => v !== null))) {
				ctx.fillStyle = AXIS_TEXT;
				ctx.textAlign = 'center';
				ctx.fillText('Pick a type, then drag across here to draw its line', PAD.left + (width - PAD.left - PAD.right) / 2, HEIGHT / 2);
			}
			return;
		}

		if (samples.length === 0) return;
		const { x } = scale;

		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		for (const type of types()) {
			ctx.strokeStyle = rules().color[type];
			ctx.beginPath();
			samples.forEach((s, i) => (i ? ctx.lineTo(x(s.t), y(s[type])) : ctx.moveTo(x(s.t), y(s[type]))));
			ctx.stroke();
		}

		// Direct labels at the end of each line, nudged apart so they don't overlap. A type that has
		// died out has nothing to point at, so it gets none (the legend and tooltip still list it).
		const last = samples.at(-1);
		const alive = types().filter((type) => last[type] > 0);
		const spread = spreadLabels(
			alive.map((type) => y(last[type])),
			LABEL_GAP,
			PAD.top,
			HEIGHT - PAD.bottom,
		);
		ctx.textAlign = 'left';
		ctx.font = '12px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
		alive.forEach((type, i) => ctx.fillText(EMOJI[type], x(last.t) + 8, spread[i]));

		// The prediction over the real curves, dashed so the two can be told apart
		if (props.showPrediction?.()) {
			ctx.setLineDash([6, 4]);
			ctx.lineWidth = 2;
			for (const type of types()) {
				const curve = completeCurve(props.prediction?.()[type] ?? emptyCurve());
				if (!curve) continue;
				ctx.strokeStyle = rules().color[type];
				drawCurve(curve, scale, scale.yMax);
			}
			ctx.setLineDash([]);
		}

		// Hover: crosshair plus a ringed dot on each line
		const h = hoveredIndex(samples);
		if (h !== null) {
			const s = samples[h];
			ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(Math.round(x(s.t)) + 0.5, PAD.top);
			ctx.lineTo(Math.round(x(s.t)) + 0.5, HEIGHT - PAD.bottom);
			ctx.stroke();
			for (const type of types()) {
				ctx.beginPath();
				ctx.arc(x(s.t), y(s[type]), 4, 0, Math.PI * 2);
				ctx.fillStyle = rules().color[type];
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = SURFACE;
				ctx.stroke();
			}
		}
	};

	const resize = () => {
		width = wrapper.clientWidth;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = HEIGHT * dpr;
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		draw();
	};

	// A pointer position as { x, y }, both 0 to 1 across the plot (y up from the baseline)
	const plotPoint = (e) => {
		const rect = canvas.getBoundingClientRect();
		const plotW = width - PAD.left - PAD.right;
		const plotH = HEIGHT - PAD.top - PAD.bottom;
		return { x: (e.clientX - rect.left - PAD.left) / plotW, y: 1 - (e.clientY - rect.top - PAD.top) / plotH };
	};

	const sketch = (from, to) => {
		const type = props.predictType();
		props.onSketch?.(type, paintCurve(props.prediction()[type] ?? emptyCurve(POINTS), from, to));
		drawing = to;
	};

	const handlePointerDown = (e) => {
		if (!props.predicting?.()) return;
		canvas.setPointerCapture?.(e.pointerId);
		const point = plotPoint(e);
		sketch(point, point);
	};

	const handlePointerMove = (e) => {
		if (props.predicting?.()) {
			if (drawing) sketch(drawing, plotPoint(e));
			return;
		}
		setPointerX(e.clientX - canvas.getBoundingClientRect().left);
	};

	const endStroke = () => {
		drawing = null;
	};

	onMount(() => {
		ctx = canvas.getContext('2d');
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(wrapper);
		onCleanup(() => observer.disconnect());
	});

	createEffect(() => {
		props.version();
		pointerX();
		props.predicting?.();
		props.predictType?.();
		props.prediction?.();
		props.showPrediction?.();
		props.rules?.();
		draw();
	});

	const tooltip = () => {
		props.version();
		if (props.predicting?.()) return null;
		const samples = props.samples();
		const h = hoveredIndex(samples);
		if (h === null) return null;
		const { x } = scales(samples);
		const left = Math.min(Math.max(x(samples[h].t), 70), width - 70);
		return { sample: samples[h], left };
	};

	return (
		<figure class="rpc-chart">
			<figcaption class="rpc-chart-header">
				<span class="rpc-chart-title">Population over time</span>
				{props.actions}
			</figcaption>
			<div class="rpc-chart-plot" ref={wrapper}>
				<canvas
					ref={canvas}
					style={{ height: `${HEIGHT}px` }}
					classList={{ sketching: !!props.predicting?.() }}
					role="img"
					aria-label={
						props.predicting?.()
							? `Drawing area for your predicted ${LABEL[props.predictType?.()]?.toLowerCase()} line. Drag to draw it, or use Quick shape instead.`
							: `Line chart of how many ${types()
									.map((type) => rules().plural[type])
									.join(', ')} are on the board over time`
					}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endStroke}
					onPointerCancel={endStroke}
					onPointerLeave={() => setPointerX(null)}
				/>
				<Show when={tooltip()}>
					{(tip) => (
						<div class="rpc-chart-tooltip" style={{ left: `${tip().left}px` }}>
							<p class="rpc-chart-tooltip-time">{tip().sample.t.toFixed(1)}s</p>
							<For each={types()}>
								{(type) => (
									<p>
										<span class="swatch" style={{ background: rules().color[type] }} />
										{LABEL[type]}
										<strong>{tip().sample[type]}</strong>
									</p>
								)}
							</For>
						</div>
					)}
				</Show>
			</div>
		</figure>
	);
}

export default PopulationChart;
