import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { SECRET_TOTAL, secretsFound, unlock } from '../state/achievements';
import './shell.css';

const AUTO_COLLAPSE_MS = 15000;

// Shown when a game is opened through one of the hidden links on the home page
// (they navigate with `state={{ found: true }}`), not when it's opened from Playground.
function FoundMessage() {
	const location = useLocation();
	const found = () => Boolean(location.state?.found);
	const [expanded, setExpanded] = createSignal(true);

	createEffect(
		on(
			() => location.key,
			() => {
				if (!found()) return;
				unlock(`found${location.pathname.replace('/', '-')}`);
				setExpanded(true);
				const timer = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
				onCleanup(() => clearTimeout(timer));
			},
		),
	);

	return (
		<Show when={found()}>
			<Show
				when={expanded()}
				fallback={
					<button class="found-tab" onClick={() => setExpanded(true)}>
						Secrets {secretsFound()}/{SECRET_TOTAL}
					</button>
				}
			>
				<aside class="found-message" role="status">
					<button class="found-close" aria-label="Dismiss" onClick={() => setExpanded(false)}>
						<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
						</svg>
					</button>
					<p class="found-eyebrow">Attention</p>
					<p class="found-title">You found one of the hidden games!</p>
					<p class="found-hint">Click the logo in the top-left corner to go back home.</p>
					<div class="found-progress">
						<span>
							Secrets found: <strong>{secretsFound()}</strong> of {SECRET_TOTAL}
						</span>
						<Show when={secretsFound() < SECRET_TOTAL}>
							<span class="found-tease">Some of them aren't links…</span>
						</Show>
					</div>
				</aside>
			</Show>
		</Show>
	);
}

export default FoundMessage;
