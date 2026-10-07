import { useLocation, useNavigate } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js';
import resumePdf from '../assets/Resume.pdf';
import { unlock, unlocked } from '../state/achievements';
import { paletteOpen, partyMode, setPaletteOpen, setTrophiesOpen, togglePartyMode } from '../state/ui';
import { save } from '../utils/storage';
import './overlays.css';

// Characters of `query` appear in order in `text`. Lower scores rank higher.
function matchScore(text, query) {
	const t = text.toLowerCase();
	if (t.startsWith(query)) return 0;
	if (t.includes(query)) return 1;
	let i = 0;
	for (const ch of t) if (ch === query[i]) i++;
	return i === query.length ? 2 : null;
}

function CommandPalette() {
	const navigate = useNavigate();
	const location = useLocation();
	const [query, setQuery] = createSignal('');
	const [active, setActive] = createSignal(0);
	let input;
	let list;

	const close = () => setPaletteOpen(false);

	const goToSection = (id) => {
		const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
		if (location.pathname === '/') scroll();
		else {
			navigate('/');
			setTimeout(scroll, 150);
		}
	};

	const openExternal = (url) => window.open(url, '_blank', 'noopener,noreferrer');

	const commands = () => [
		{ group: 'Jump to', label: 'About', icon: '👋', run: () => goToSection('about') },
		{ group: 'Jump to', label: 'Projects', icon: '🛠️', run: () => goToSection('projects') },
		{ group: 'Jump to', label: 'Playground', icon: '🎮', run: () => goToSection('playground') },
		{ group: 'Play', label: 'Neon Ricochet', icon: '✦', run: () => navigate('/neon-ricochet') },
		{ group: 'Play', label: 'RPC Simulator', icon: '✂️', run: () => navigate('/rpc-simulator') },
		{ group: 'Play', label: 'Memory Game', icon: '🃏', run: () => navigate('/memory-game') },
		{ group: 'Play', label: 'TicTacToe vs AI', icon: '⭕', run: () => navigate('/tictactoe') },
		{ group: 'Play', label: 'Ultimate TicTacToe', icon: '❌', run: () => navigate('/tictactoe/ultimate') },
		{ group: 'Play', label: 'Play a friend online', icon: '🌐', run: () => navigate('/tictactoe/online') },
		{
			group: 'Play',
			label: 'Memory daily challenge',
			icon: '📅',
			// The Memory Game opens in whichever mode it was last left in
			run: () => {
				save('memory-mode', 'daily');
				navigate('/memory-game');
			},
		},
		{ group: 'Play', label: 'Games & stats', icon: '📊', run: () => navigate('/games') },
		{ group: 'Contact', label: 'Send me a message', icon: '✉️', run: () => navigate('/contact') },
		{ group: 'Contact', label: 'Open résumé (PDF)', icon: '📄', run: () => openExternal(resumePdf) },
		{ group: 'Contact', label: 'GitHub', icon: '🐙', run: () => openExternal('https://github.com/Alfredx48') },
		{ group: 'Contact', label: 'LinkedIn', icon: '💼', run: () => openExternal('https://www.linkedin.com/in/alfredx48/') },
		{ group: 'Fun', label: 'Achievements', icon: '🏆', run: () => setTrophiesOpen(true) },
		// Only offered once you've found it the old-fashioned way
		...(unlocked().has('konami')
			? [{ group: 'Fun', label: partyMode() ? 'Stop the party' : 'Party mode', icon: '🎉', run: togglePartyMode }]
			: []),
	];

	const results = createMemo(() => {
		const q = query().trim().toLowerCase();
		if (!q) return commands();
		return commands()
			.map((command) => ({ command, score: matchScore(`${command.label} ${command.group}`, q) }))
			.filter((r) => r.score !== null)
			.sort((a, b) => a.score - b.score)
			.map((r) => r.command);
	});

	createEffect(
		on(paletteOpen, (open) => {
			if (!open) return;
			setQuery('');
			setActive(0);
			unlock('palette');
			queueMicrotask(() => input?.focus());
		}),
	);

	// Keep the highlighted option in range and scrolled into view
	createEffect(() => {
		if (active() >= results().length) setActive(Math.max(0, results().length - 1));
		list?.querySelector(`[data-index="${active()}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	const run = (command) => {
		if (!command) return;
		close();
		command.run();
	};

	const handleKeyDown = (e) => {
		const count = results().length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActive((i) => (i + 1) % Math.max(count, 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActive((i) => (i - 1 + count) % Math.max(count, 1));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			run(results()[active()]);
		} else if (e.key === 'Escape') {
			close();
		}
	};

	return (
		<Show when={paletteOpen()}>
			<div class="overlay" onClick={close}>
				<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
					<input
						ref={input}
						class="palette-input"
						type="text"
						placeholder="Where to? Try “memory” or “résumé”"
						role="combobox"
						aria-expanded="true"
						aria-controls="palette-list"
						aria-activedescendant={results().length ? `palette-option-${active()}` : undefined}
						value={query()}
						onInput={(e) => {
							setQuery(e.currentTarget.value);
							setActive(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					<ul id="palette-list" class="palette-list" role="listbox" ref={list}>
						<For each={results()} fallback={<li class="palette-empty">Nothing matches “{query()}”</li>}>
							{(command, index) => (
								<li
									id={`palette-option-${index()}`}
									data-index={index()}
									role="option"
									aria-selected={active() === index()}
									classList={{ active: active() === index() }}
									onMouseMove={() => setActive(index())}
									onClick={() => run(command)}
								>
									<span class="palette-icon" aria-hidden="true">
										{command.icon}
									</span>
									{command.label}
									<span class="palette-group">{command.group}</span>
								</li>
							)}
						</For>
					</ul>
					<p class="palette-hints" aria-hidden="true">
						<span>
							<kbd>↑</kbd>
							<kbd>↓</kbd> move
						</span>
						<span>
							<kbd>Enter</kbd> open
						</span>
						<span>
							<kbd>Esc</kbd> close
						</span>
					</p>
				</div>
			</div>
		</Show>
	);
}

export default CommandPalette;
