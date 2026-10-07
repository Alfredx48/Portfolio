import { For, Show } from 'solid-js';
import Segmented from '../ui/Segmented';
import { hasSketch, PRESETS } from './prediction';

// The chart's "Predict" controls. `state()` is 'idle' (before the round, can sketch), 'locked' (the round
// is on, or the board was changed after it ended) or 'done' (it ended, and Predict starts a fresh board).
// While `active()` the user picks a type (`type()`, `onType`), then draws on the chart or picks a quick shape
// for it (`onPreset(type, kind)`), and can `onClear` that type's line. `onToggle` opens and closes sketching,
// `prediction()` is { type: curve }, and `result()` is { score, accuracy } once the round is scored, or null.
function PredictControls(props) {
	const options = () =>
		props.rules().types.map((type) => ({
			value: type,
			label: `${props.rules().emoji[type]}${hasSketch(props.prediction()[type]) ? ' ✓' : ''}`,
			title: props.rules().label[type],
			ariaLabel: `Draw ${props.rules().label[type].toLowerCase()}`,
		}));
	const sketched = () => Object.values(props.prediction()).some(hasSketch);

	return (
		<div class="rpc-predict">
			<Show when={props.state() === 'idle' && props.active()}>
				<Segmented label="Line to draw" options={options()} value={props.type()} onChange={props.onType} />
				<label class="rpc-predict-preset">
					<span class="sr-only">Quick shape for the {props.rules().label[props.type()]} line</span>
					<select
						value=""
						onChange={(e) => {
							if (e.currentTarget.value) props.onPreset(props.type(), e.currentTarget.value);
							e.currentTarget.value = '';
						}}
					>
						<option value="">Quick shape…</option>
						<For each={PRESETS}>{(preset) => <option value={preset.value}>{preset.label}</option>}</For>
					</select>
				</label>
				<button type="button" class="btn btn-ghost" onClick={() => props.onClear(props.type())}>
					Clear line
				</button>
			</Show>
			{/* Always in the page, so screen readers announce the score when it appears */}
			<span class="rpc-predict-note" role="status" aria-live="polite">
				<Show when={props.state() === 'locked' && sketched()}>🔮 Prediction locked in</Show>
				<Show when={props.state() === 'done' && props.result()}>
					{(result) => (
						<>
							🔮 Prediction score <strong>{result().score}</strong>/100{' '}
							<span class="rpc-predict-key">
								({result().accuracy}% accurate; 0 = no better than a flat guess; dashed = your prediction)
							</span>
						</>
					)}
				</Show>
			</span>
			<Show when={props.state() !== 'locked'}>
				<button type="button" class="btn btn-ghost" aria-pressed={props.active()} onClick={props.onToggle}>
					{props.active() ? 'Done' : '🔮 Predict'}
				</button>
			</Show>
		</div>
	);
}

export default PredictControls;
