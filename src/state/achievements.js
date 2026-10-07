import { createSignal } from 'solid-js';
import { load, save } from '../utils/storage';
import { toast } from '../utils/toast';

const STORAGE_KEY = 'achievements';

// `secret` ones count toward the "secrets found" total on the found-a-game message.
// `computerOnly` ones need a mouse or keyboard, and are labelled as such on touch screens.
export const ACHIEVEMENTS = [
	{ id: 'ricochet-first-sector', title: 'First Frequency', hint: 'Clear the first sector in Neon Ricochet.', description: 'Cleared the first Neon Ricochet sector.' },
	{ id: 'ricochet-combo', title: 'Chain Reaction', hint: 'Reach an eight-hit combo in Neon Ricochet.', description: 'Reached an eight-hit Neon Ricochet combo.' },
	{ id: 'ricochet-clear', title: 'Signal Restored', hint: 'Clear all five Neon Ricochet sectors.', description: 'Cleared all five Neon Ricochet sectors.' },
	{ id: 'found-memory-game', computerOnly: true, title: 'Memory Lane', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden Memory Game link.', secret: true },
	{ id: 'found-rpc-simulator', computerOnly: true, title: 'Under the Spotlight', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden RPC Simulator link.', secret: true },
	{ id: 'found-tictactoe', computerOnly: true, title: 'X Marks the Spot', hint: 'Something is hiding in the dark on the home page.', description: 'Found the hidden TicTacToe link.', secret: true },
	{ id: 'konami', computerOnly: true, title: 'Old School', hint: 'Some codes never go out of style.', description: 'Entered the Konami code. ↑↑↓↓←→←→BA', secret: true },
	{ id: 'palette', computerOnly: true, title: 'Power User', hint: 'Keyboard people have a shortcut.', description: 'Opened the command palette.' },
	{ id: 'ttt-beat-medium', title: 'Outsmarted', hint: 'Beat the TicTacToe AI on Medium.', description: 'Beat the TicTacToe AI on Medium.' },
	{ id: 'ttt-draw-impossible', title: 'Stalemate', hint: 'The Impossible AI can’t lose. Can you stop it winning?', description: 'Held the Impossible AI to a draw.' },
	{ id: 'ttt-quick-win', title: 'Blitz', hint: 'Beat the TicTacToe AI in three moves.', description: 'Beat the TicTacToe AI in three moves.' },
	{ id: 'ttt-endless-impossible', title: 'Never-Ending Story', hint: 'Endless mode gives you more chances. Use them on Impossible.', description: 'Beat the Impossible AI in Endless mode.' },
	{ id: 'ttt-big-board', title: 'Room to Move', hint: 'Win on a 5×5 TicTacToe board against the AI.', description: 'Beat the AI on a 5×5 board.' },
	{ id: 'ttt-ultimate', title: 'Big Picture', hint: 'Win a game of Ultimate TicTacToe against the AI.', description: 'Won Ultimate TicTacToe against the AI.' },
	{ id: 'memory-combo', title: 'On a Roll', hint: 'Match four pairs in a row in the Memory Game.', description: 'Matched four pairs in a row.' },
	{ id: 'memory-hard', title: 'Total Recall', hint: 'Clear the Memory Game on Hard.', description: 'Cleared the Memory Game on Hard.' },
	{ id: 'memory-daily', title: 'Daily Grind', hint: 'Finish the Memory Game daily challenge.', description: 'Finished a Memory Game daily challenge.' },
	{ id: 'memory-time-attack', title: 'Against the Clock', hint: 'Survive Time Attack in the Memory Game.', description: 'Cleared the Memory Game in Time Attack.' },
	{ id: 'rpc-prophet', title: 'Prophet', hint: 'Call three RPC Simulator winners in a row.', description: 'Called three RPC winners in a row.' },
	{ id: 'rpc-statistician', title: 'Statistician', hint: 'Run 100 RPC simulations in one go.', description: 'Ran 100 RPC simulations in one batch.' },
	{ id: 'rpc-lizard-spock', title: 'Bazinga', hint: 'Rock, paper, scissors… and two more?', description: 'Ran Rock-Paper-Scissors-Lizard-Spock.' },
	{ id: 'rpc-mad-scientist', title: 'Mad Scientist', hint: 'Bend the rules in the RPC Simulator sandbox.', description: 'Changed the RPC Simulator sandbox rules.' },
	{ id: 'rpc-oracle', title: 'Oracle', hint: 'Sketch an RPC population chart before it happens, and beat a flat guess by a wide margin.', description: 'Predicted an RPC population chart far better than a flat guess.' },
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
