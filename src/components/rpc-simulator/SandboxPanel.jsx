import { For } from 'solid-js';
import { COUNT_RANGE, RADIUS_RANGE, SPEED_RANGE } from './sandbox';

const times = (value) => `${value}×`;

// Sliders for bending the rules: how fast each type moves, how many of each start, and how close
// pieces must be to fight. Shown or hidden by the page (`open()`), which keeps it mounted so the settings
// are always there. `sandbox()` is the current settings (see sandbox.js), `count()` is what a type starts
// with unless it has its own count, `custom()` is true when anything differs from a plain game, and
// `lockCounts()` stops the start counts changing mid-round. `onChange(next)` gets the whole new settings
// and `onReset()` is "Reset to defaults".
function SandboxPanel(props) {
	const types = () => props.rules().types;
	const update = (key, name, value) => props.onChange({ ...props.sandbox(), [key]: { ...props.sandbox()[key], [name]: value } });
	const read = (e) => parseFloat(e.currentTarget.value);

	return (
		<section class="rpc-sandbox" id="rpc-sandbox" aria-label="Sandbox" hidden={!props.open()}>
			<div class="rpc-sandbox-body">
				<div class="rpc-sandbox-grid" role="group" aria-label="Per-type settings">
					<span class="rpc-stats-label rpc-sandbox-head">Type</span>
					<span class="rpc-stats-label rpc-sandbox-head">Speed</span>
					<span class="rpc-stats-label rpc-sandbox-head">Start count</span>
					<For each={types()}>
						{(name) => (
							<>
								<span class="rpc-sandbox-name">
									<span class="swatch" style={{ background: props.rules().color[name] }} />
									{props.rules().emoji[name]} {props.rules().label[name]}
								</span>
								<label class="rpc-sandbox-slider">
									<input
										type="range"
										aria-label={`${props.rules().label[name]} speed`}
										min={SPEED_RANGE.min}
										max={SPEED_RANGE.max}
										step={SPEED_RANGE.step}
										value={props.sandbox().speed[name]}
										onInput={(e) => update('speed', name, read(e))}
									/>
									<output>{times(props.sandbox().speed[name])}</output>
								</label>
								<label class="rpc-sandbox-slider">
									<input
										type="range"
										aria-label={`${props.rules().label[name]} starting count`}
										min={COUNT_RANGE.min}
										max={COUNT_RANGE.max}
										step="1"
										value={props.sandbox().counts[name] ?? props.count()}
										disabled={props.lockCounts()}
										onInput={(e) => update('counts', name, read(e) === props.count() ? null : read(e))}
									/>
									<output>{props.sandbox().counts[name] ?? props.count()}</output>
								</label>
							</>
						)}
					</For>
				</div>

				<label class="rpc-sandbox-radius">
					<span>
						Interaction radius <small>how close pieces must be to fight</small>
					</span>
					<input
						type="range"
						aria-label="Interaction radius"
						min={RADIUS_RANGE.min}
						max={RADIUS_RANGE.max}
						step={RADIUS_RANGE.step}
						value={props.sandbox().radius}
						onInput={(e) => props.onChange({ ...props.sandbox(), radius: read(e) })}
					/>
					<output>{times(props.sandbox().radius)}</output>
				</label>

				<div class="rpc-sandbox-foot">
					<p>Speed and radius change the round as it plays. Start counts apply to the next board.</p>
					<button type="button" class="btn btn-ghost" disabled={!props.custom()} onClick={props.onReset}>
						Reset to defaults
					</button>
				</div>
			</div>
		</section>
	);
}

export default SandboxPanel;
