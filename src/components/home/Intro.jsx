import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { setPaletteOpen, shortcutLabel } from '../../state/ui';
import Socials from './Socials';

const sections = [
	{ id: 'about', label: 'About' },
	{ id: 'projects', label: 'Projects' },
	{ id: 'playground', label: 'Playground' },
];

// Invisible until the cursor's spotlight passes over them (see .secret-link in home.css).
const secrets = [
	{ href: '/memory-game', label: 'Memory Game' },
	{ href: '/rpc-simulator', label: 'RPC Simulator' },
	{ href: '/tictactoe', label: 'TicTacToe' },
];

function Intro(props) {
	return (
		<header class="intro">
			<div>
				<h1 class="intro-name">Alfred Shaheen</h1>
				<h2 class="intro-title">Full Stack Software Engineer</h2>
				<p class="intro-tagline">
					Turned life's curveball into coding passion. Lifelong learner. Resilient. Excited for what's next.
				</p>

				<nav class="section-nav" aria-label="Sections">
					<ul>
						<For each={sections}>
							{(section) => (
								<li>
									<a
										href={`#${section.id}`}
										classList={{ active: props.activeSection === section.id }}
										aria-current={props.activeSection === section.id ? 'true' : undefined}
									>
										<span class="nav-line" />
										{section.label}
									</a>
								</li>
							)}
						</For>
					</ul>
				</nav>

				<div class="intro-actions">
					<A href="/contact" class="btn">
						Get in Touch
					</A>
					<button class="palette-hint" onClick={() => setPaletteOpen(true)}>
						or press <kbd>{shortcutLabel}</kbd> to jump anywhere
					</button>
				</div>
			</div>

			<div class="secret-links">
				<For each={secrets}>
					{(secret) => (
						<A href={secret.href} state={{ found: true }} class="secret-link">
							{secret.label}
						</A>
					)}
				</For>
			</div>

			<Socials />
		</header>
	);
}

export default Intro;
