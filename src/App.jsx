import { A } from '@solidjs/router';
import { onCleanup, onMount } from 'solid-js';
import CommandPalette from './components/CommandPalette';
import FoundMessage from './components/FoundMessage';
import Logo from './components/Logo';
import Trophies from './components/Trophies';
import { unlock } from './state/achievements';
import { setPaletteOpen, setTrophiesOpen, togglePartyMode } from './state/ui';
import { toast } from './utils/toast';

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

function App(props) {
	onMount(() => {
		let konamiProgress = 0;

		const handleKeyDown = (e) => {
			const key = e.key.toLowerCase();

			if (key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setTrophiesOpen(false);
				setPaletteOpen((open) => !open);
				return;
			}
			if (key === 'escape') {
				setPaletteOpen(false);
				setTrophiesOpen(false);
				return;
			}

			// ↑ ↑ ↓ ↓ ← → ← → B A
			konamiProgress = key === KONAMI[konamiProgress] ? konamiProgress + 1 : key === KONAMI[0] ? 1 : 0;
			if (konamiProgress === KONAMI.length) {
				konamiProgress = 0;
				unlock('konami');
				const on = togglePartyMode();
				toast(on ? '🎉 Party mode! Enter the code again to stop.' : 'Party over.', 'info');
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
	});

	return (
		<>
			<A href="/" class="logo-link" aria-label="Home">
				<Logo />
			</A>
			<FoundMessage />
			<main>{props.children}</main>
			<Trophies />
			<CommandPalette />
		</>
	);
}

export default App;
