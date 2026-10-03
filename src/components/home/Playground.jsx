import { A } from '@solidjs/router';
import { For } from 'solid-js';
import playgroundData from '../../data/playgroundData';

function Playground() {
	return (
		<section id="playground" class="section" aria-labelledby="playground-heading">
			<h2 id="playground-heading" class="section-heading">
				Playground
			</h2>
			<p class="section-lede">
				Small games built to try out ideas. They're also hidden somewhere on this page if you'd rather find
				them yourself.
			</p>
			<div class="card-list">
				<For each={playgroundData}>
					{(game) => (
						<A href={game.href} class="card game-card">
							<span class="game-icon" aria-hidden="true">
								{game.icon}
							</span>
							<span>
								<span class="card-title">
									{game.name}
									<span class="arrow" aria-hidden="true">
										→
									</span>
								</span>
								<span class="game-description">{game.description}</span>
							</span>
						</A>
					)}
				</For>
			</div>
		</section>
	);
}

export default Playground;
