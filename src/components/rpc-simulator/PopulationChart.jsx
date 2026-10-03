import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { COLOR, EMOJI, LABEL, TYPES } from './simulation';

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
// `samples()` returns [{ t, rock, paper, scissors }]; `version()` changes whenever it grows.
function PopulationChart(props) {
	let wrapper;
	let canvas;
	let ctx;
	let width = 0;
	const [pointerX, setPointerX] = createSignal(null); // px within the canvas, while hovering

	const scales = (samples) => {
		const tMax = Math.max(samples.at(-1)?.t ?? 0, 1);
		const yMax = Math.max(1, ...samples.map((s) => s.rock + s.paper + s.scissors));
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

	const draw = () => {
		if (!ctx || !width) return;
		const samples = props.samples();
		const { tMax, yMax, x, y } = scales(samples);

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
		ctx.fillText('0s', PAD.left, HEIGHT - 8);
		ctx.textAlign = 'right';
		ctx.fillText(`${tMax.toFixed(tMax < 10 ? 1 : 0)}s`, width - PAD.right, HEIGHT - 8);

		if (samples.length === 0) return;

		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		for (const type of TYPES) {
			ctx.strokeStyle = COLOR[type];
			ctx.beginPath();
			samples.forEach((s, i) => (i ? ctx.lineTo(x(s.t), y(s[type])) : ctx.moveTo(x(s.t), y(s[type]))));
			ctx.stroke();
		}

		// Direct labels at the end of each line, nudged apart so they don't overlap
		const last = samples.at(-1);
		const labels = TYPES.map((type) => ({ type, y: y(last[type]) })).sort((a, b) => a.y - b.y);
		for (let i = 1; i < labels.length; i++) {
			labels[i].y = Math.max(labels[i].y, labels[i - 1].y + LABEL_GAP);
		}
		ctx.textAlign = 'left';
		ctx.font = '12px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
		for (const label of labels) ctx.fillText(EMOJI[label.type], x(last.t) + 8, label.y);

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
			for (const type of TYPES) {
				ctx.beginPath();
				ctx.arc(x(s.t), y(s[type]), 4, 0, Math.PI * 2);
				ctx.fillStyle = COLOR[type];
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

	const handlePointerMove = (e) => setPointerX(e.clientX - canvas.getBoundingClientRect().left);

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
		draw();
	});

	const tooltip = () => {
		props.version();
		const samples = props.samples();
		const h = hoveredIndex(samples);
		if (h === null) return null;
		const { x } = scales(samples);
		const left = Math.min(Math.max(x(samples[h].t), 70), width - 70);
		return { sample: samples[h], left };
	};

	return (
		<figure class="rpc-chart">
			<figcaption class="rpc-chart-title">Population over time</figcaption>
			<div class="rpc-chart-plot" ref={wrapper}>
				<canvas
					ref={canvas}
					style={{ height: `${HEIGHT}px` }}
					role="img"
					aria-label="Line chart of how many rocks, papers and scissors are on the board over time"
					onPointerMove={handlePointerMove}
					onPointerLeave={() => setPointerX(null)}
				/>
				<Show when={tooltip()}>
					{(tip) => (
						<div class="rpc-chart-tooltip" style={{ left: `${tip().left}px` }}>
							<p class="rpc-chart-tooltip-time">{tip().sample.t.toFixed(1)}s</p>
							<For each={TYPES}>
								{(type) => (
									<p>
										<span class="swatch" style={{ background: COLOR[type] }} />
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
