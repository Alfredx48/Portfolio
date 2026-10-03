import { createEffect, For, on, Show } from 'solid-js';
import { ACHIEVEMENTS, resetAchievements, unlocked } from '../state/achievements';
import { setTrophiesOpen, trophiesOpen } from '../state/ui';
import './overlays.css';

// A trophy counter that appears once you've earned something, and the panel it opens.
function Trophies() {
	let closeButton;
	const earned = () => unlocked().size;
	const close = () => setTrophiesOpen(false);

	createEffect(on(trophiesOpen, (open) => open && queueMicrotask(() => closeButton?.focus())));

	const reset = () => {
		if (window.confirm('Reset all achievements?')) resetAchievements();
	};

	return (
		<>
			<Show when={earned() > 0}>
				<button class="trophy-button" onClick={() => setTrophiesOpen(true)} aria-label={`Achievements: ${earned()} of ${ACHIEVEMENTS.length}`}>
					🏆 {earned()}/{ACHIEVEMENTS.length}
				</button>
			</Show>

			<Show when={trophiesOpen()}>
				<div class="overlay" onClick={close} onKeyDown={(e) => e.key === 'Escape' && close()}>
					<div class="trophies" role="dialog" aria-modal="true" aria-labelledby="trophies-title" onClick={(e) => e.stopPropagation()}>
						<header class="trophies-header">
							<h2 id="trophies-title">Achievements</h2>
							<button ref={closeButton} class="icon-button" onClick={close} aria-label="Close">
								<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
									<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
								</svg>
							</button>
						</header>

						<div class="trophies-progress" aria-hidden="true">
							<span style={{ width: `${(earned() / ACHIEVEMENTS.length) * 100}%` }} />
						</div>
						<p class="trophies-count">
							{earned()} of {ACHIEVEMENTS.length} unlocked
						</p>

						<ul class="trophies-list">
							<For each={ACHIEVEMENTS}>
								{(a) => (
									<li classList={{ earned: unlocked().has(a.id) }}>
										<span class="trophy-icon" aria-hidden="true">
											{unlocked().has(a.id) ? '🏆' : '🔒'}
										</span>
										<span>
											<strong>{unlocked().has(a.id) ? a.title : '???'}</strong>
											<span class="trophy-text">{unlocked().has(a.id) ? a.description : a.hint}</span>
										</span>
									</li>
								)}
							</For>
						</ul>

						<Show when={earned() > 0}>
							<button class="trophies-reset" onClick={reset}>
								Reset progress
							</button>
						</Show>
					</div>
				</div>
			</Show>
		</>
	);
}

export default Trophies;
