import { For } from 'solid-js';
import './segmented.css';

// A row of mutually exclusive buttons, e.g. Easy / Medium / Hard.
function Segmented(props) {
	return (
		<div class="segmented" role="radiogroup" aria-label={props.label}>
			<For each={props.options}>
				{(option) => (
					<button
						type="button"
						role="radio"
						aria-checked={props.value === option.value}
						classList={{ active: props.value === option.value }}
						disabled={props.disabled}
						title={option.title}
						aria-label={option.ariaLabel}
						onClick={() => props.onChange(option.value)}
					>
						{option.label}
					</button>
				)}
			</For>
		</div>
	);
}

export default Segmented;
