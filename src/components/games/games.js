import { hasPrefix } from './stats';

// `stats` names the key in readStats()'s result; `achievements` picks which achievements count for
// the card. 'ttt-' is shared by all three TicTacToe pages, so Ultimate claims its own and the
// plain game gets the rest. Online has nothing to earn or save, so it has neither.
const ultimateOnly = (a) => a.id === 'ttt-ultimate';

export const GAMES = [
	{ id: 'ricochet', name: 'Neon Ricochet', href: '/neon-ricochet', icon: '✦', description: 'An arcade expedition with three ships, twelve sectors, and three boss encounters. Draft permanent upgrades, unleash Nova Pulse, or jump straight into Boss Rush.', stats: 'ricochet', empty: 'Pick a ship. Build your loadout. Challenge the crown.', achievements: hasPrefix('ricochet-') },
	{
		id: 'tictactoe',
		name: 'TicTacToe',
		href: '/tictactoe',
		icon: '⭕',
		description: 'Take on an AI that goes from forgiving to unbeatable, or a friend on the same screen. 3×3, 4×4 and 5×5 boards, with Endless rules where nobody gets to draw. Try match series or Orbit, where the outer ring moves after every two turns.',
		stats: 'tictactoe',
		empty: 'Not played yet. Start on Easy and work up to Impossible.',
		achievements: (a) => hasPrefix('ttt-')(a) && !ultimateOnly(a),
	},
	{
		id: 'ultimate',
		name: 'Ultimate TicTacToe',
		href: '/tictactoe/ultimate',
		icon: '❌',
		description: 'Nine boards in one. Where you play decides where your opponent has to play next. Preview the destination or spend a wildcard to escape the forced board once.',
		stats: 'ultimate',
		empty: 'Not played yet. Remember: your move sends them to the matching board.',
		achievements: ultimateOnly,
	},
	{
		id: 'online',
		name: 'Online TicTacToe',
		href: '/tictactoe/online',
		icon: '🌐',
		description: 'Send a link, play a friend anywhere. Moves go straight between your two browsers, with no account and no sign-up. A move log keeps the round easy to follow, and quick reactions add a little table talk.',
		cta: 'Nothing to save here. Start a room, send the link, and see who blinks first.',
	},
	{
		id: 'memory',
		name: 'Memory Game',
		href: '/memory-game',
		icon: '🃏',
		description: 'Match pairs of tech logos on three difficulties. Chain matches for combos, race the clock in Time Attack, or take on the daily board everyone shares. Try Drift, where unmatched cards shuffle after every third miss. Pause Classic and Drift games when you need a break.',
		stats: 'memory',
		empty: 'Not played yet. Three stars are waiting.',
		achievements: hasPrefix('memory-'),
	},
	{
		id: 'rpc',
		name: 'RPC Simulator',
		href: '/rpc-simulator',
		icon: '✂️',
		description: 'Rocks, papers and scissors roam a canvas converting each other until one is left. Bet on the winner, sketch the population chart, or rewrite the rules in the sandbox. Step through a paused simulation, or enable portals and bend the arena’s space.',
		stats: 'rpc',
		empty: 'No bets yet. Pick a winner and see if you’re right.',
		achievements: hasPrefix('rpc-'),
	},
];
