import { createSignal } from 'solid-js';
import { load, save } from '../utils/storage';
import { toast } from '../utils/toast';

const STORAGE_KEY = 'achievements';

// `secret` ones count toward the "secrets found" total on the found-a-game message.
// `computerOnly` ones need a mouse or keyboard, and are labelled as such on touch screens.
export const ACHIEVEMENTS = [
	{ id: 'found-memory-game', computerOnly: true, title: 'Memory Lane', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden Memory Game link.', secret: true },
	{ id: 'found-rpc-simulator', computerOnly: true, title: 'Under the Spotlight', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden RPC Simulator link.', secret: true },
	{ id: 'found-tictactoe', computerOnly: true, title: 'X Marks the Spot', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden TicTacToe link.', secret: true },
	{ id: 'konami', computerOnly: true, title: 'Old School', hint: 'Some codes never go out of style.', description: 'Entered the Konami code. ↑↑↓↓←→←→BA', secret: true },
	{ id: 'palette', computerOnly: true, title: 'Power User', hint: 'Keyboard people have a shortcut.', description: 'Opened the command palette.' },
	{ id: 'ttt-beat-medium', title: 'Outsmarted', hint: 'Beat the TicTacToe AI on Medium.', description: 'Beat the TicTacToe AI on Medium.' },
	{ id: 'ttt-draw-impossible', title: 'Stalemate', hint: 'The Impossible AI can’t lose. Can you stop it winning?', description: 'Held the Impossible AI to a draw.' },
	{ id: 'memory-combo', title: 'On a Roll', hint: 'Match four pairs in a row in the Memory Game.', description: 'Matched four pairs in a row.' },
	{ id: 'memory-hard', title: 'Total Recall', hint: 'Clear the Memory Game on Hard.', description: 'Cleared the Memory Game on Hard.' },
	{ id: 'rpc-prophet', title: 'Prophet', hint: 'Call three RPC Simulator winners in a row.', description: 'Called three RPC winners in a row.' },
	{ id: 'rpc-statistician', title: 'Statistician', hint: 'Run 100 RPC simulations in one go.', description: 'Ran 100 RPC simulations in one batch.' },
];

export const SECRET_TOTAL = ACHIEVEMENTS.filter((a) => a.secret).length;

const [unlocked, setUnlocked] = createSignal(new Set(load(STORAGE_KEY, [])));
export { unlocked };

export const secretsFound = () => ACHIEVEMENTS.filter((a) => a.secret && unlocked().has(a.id)).length;

export function unlock(id) {
	const achievement = ACHIEVEMENTS.find((a) => a.id === id);
	if (!achievement || unlocked().has(id)) return;
	const next = new Set(unlocked()).add(id);
	setUnlocked(next);
	save(STORAGE_KEY, [...next]);
	toast(`🏆 Achievement unlocked: ${achievement.title}`, 'achievement');
}

export function resetAchievements() {
	setUnlocked(new Set());
	save(STORAGE_KEY, []);
}
