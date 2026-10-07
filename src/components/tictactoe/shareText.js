const EMOJI = { X: '❌', O: '⭕', '': '⬜' };

// "Impossible" is only literally true on 3×3; the bigger boards use a deep search that can be beaten
export function difficultyLabel(difficulty, size = 3) {
	if (difficulty === 'impossible' && size > 3) return 'Hard';
	return difficulty[0].toUpperCase() + difficulty.slice(1);
}

// The final board as emoji rows, whatever its size
export function boardEmoji(cells) {
	const size = Math.round(Math.sqrt(cells.length));
	return Array.from({ length: size }, (_, row) =>
		cells.slice(row * size, (row + 1) * size).map((cell) => EMOJI[cell]).join(''),
	).join('\n');
}

// A short, shareable summary of a finished game
export function resultText({ result, vsAi, human, difficulty, rules, size, cells, url }) {
	const where = `${rules === 'endless' ? ' in Endless mode' : rules === 'orbit' ? ' in Orbit mode' : ''} ⭕❌${size > 3 ? ` (${size}×${size})` : ''}`;
	const ai = `${difficultyLabel(difficulty, size)} TicTacToe AI`;
	let headline;
	if (!result.player) headline = vsAi ? `I held the ${ai} to a draw${where}` : `Our TicTacToe game ended in a draw${where}`;
	else if (!vsAi) headline = `${result.player} won a game of 2-player TicTacToe${where}`;
	else if (result.player === human) headline = `I beat the ${ai}${where}`;
	else headline = `The ${ai} got me this time${where}`;

	return [headline, boardEmoji(cells), `Think you can do better? ${url}`].filter(Boolean).join('\n');
}
