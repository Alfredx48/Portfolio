import { A } from '@solidjs/router';
import { For, onMount, Show } from 'solid-js';
import { ACHIEVEMENTS, unlocked } from '../../state/achievements';
import { load, save } from '../../utils/storage';
import { formatTime } from '../memory-game/deck';
import { GAMES } from './games';
import './games.css';
import { achievementProgress, readStats, starsText } from './stats';

// The Memory Game opens in whichever mode it was last left in, so ask for the daily one
const openDaily = () => save('memory-mode', 'daily');

function GamesHub() {
	// Read once on arrival: nothing changes while you're looking at this page
	const stats = readStats(load);
	const daily = stats.daily;

	onMount(() => (document.title = 'Games | Alfred Shaheen'));

	return (
		<section class="page games">
			<div class="games-header">
				<A href="/" class="back-link">
					<span aria-hidden="true">←</span> Home
				</A>
				<h1 class="page-title">Games</h1>
				<p class="games-lede">Little things I built to try out ideas, and how you’re getting on with them. Your progress lives in this browser only.</p>
			</div>

			<aside class="games-daily" classList={{ done: daily.done }} aria-labelledby="games-daily-title">
				<span class="games-daily-icon" aria-hidden="true">
					{daily.done ? '✅' : '📅'}
				</span>
				<div class="games-daily-text">
					<h2 id="games-daily-title">{daily.done ? 'Today’s Memory challenge is done' : 'Today’s Memory challenge is waiting'}</h2>
					<p>
						<Show
							when={daily.done}
							fallback={
								<>
									One shared board, one go that counts. {daily.streak ? `Keep your ${daily.streak}-day streak alive.` : 'Start a streak.'}
								</>
							}
						>
							<span class="games-daily-stars" aria-label={`${daily.stars} out of 3 stars`}>
								{starsText(daily.stars)}
							</span>{' '}
							{daily.moves} moves in {formatTime(daily.time)}
							{daily.streak > 1 ? ` · ${daily.streak}-day streak` : ''}. A new board arrives at midnight.
						</Show>
					</p>
				</div>
				<A href="/memory-game" class="btn games-daily-button" classList={{ 'btn-ghost': daily.done }} onClick={openDaily}>
					{daily.done ? 'Replay' : 'Play today’s'} <span aria-hidden="true">→</span>
				</A>
			</aside>

			<ul class="games-grid">
				<For each={GAMES}>
					{(game) => {
						const gameStats = () => (game.stats ? stats[game.stats] : []);
						const progress = () => (game.achievements ? achievementProgress(ACHIEVEMENTS, unlocked(), game.achievements) : null);
						return (
							<li class="games-card" id={`game-${game.id}`}>
								<header class="games-card-header">
									<span class="games-icon" aria-hidden="true">
										{game.icon}
									</span>
									<h2>{game.name}</h2>
								</header>
								<p class="games-description">{game.description}</p>

								<Show when={game.stats} fallback={<p class="games-cta">{game.cta}</p>}>
									<Show when={gameStats().length} fallback={<p class="games-cta">{game.empty}</p>}>
										<dl class="games-stats">
											<For each={gameStats()}>
												{(stat) => (
													<div>
														<dt>{stat.label}</dt>
														<dd>{stat.value}</dd>
													</div>
												)}
											</For>
										</dl>
									</Show>
								</Show>

								<Show when={progress()?.total}>
									<div class="games-achievements">
										<p class="games-ach-count">
											<span aria-hidden="true">🏆</span> {progress().earned} / {progress().total} {progress().total === 1 ? 'achievement' : 'achievements'}
										</p>
										<div class="games-ach-bar" aria-hidden="true">
											<span style={{ width: `${(progress().earned / progress().total) * 100}%` }} />
										</div>
										<Show when={progress().titles.length}>
											<ul class="games-chips" aria-label="Unlocked achievements">
												<For each={progress().titles}>{(title) => <li>{title}</li>}</For>
											</ul>
										</Show>
										<Show when={progress().next}>
											<p class="games-next">Next up: {progress().next}</p>
										</Show>
									</div>
								</Show>

								<A href={game.href} class="btn games-play" aria-label={`Play ${game.name}`}>
									Play <span aria-hidden="true">→</span>
								</A>
							</li>
						);
					}}
				</For>
			</ul>
		</section>
	);
}

export default GamesHub;
