import { describe, expect, it } from 'vitest';
import { boardEmoji, difficultyLabel, resultText } from './shareText';

const cells = (s) => [...s].map((c) => (c === '.' ? '' : c));
const url = 'https://example.com/tictactoe';
const win = { player: 'X', line: [0, 1, 2] };
const draw = { player: null, line: [] };

describe('difficultyLabel', () => {
	it('capitalises the level', () => {
		expect(difficultyLabel('easy')).toBe('Easy');
		expect(difficultyLabel('medium', 5)).toBe('Medium');
	});

	it('calls the top level Impossible only on 3×3', () => {
		expect(difficultyLabel('impossible', 3)).toBe('Impossible');
		expect(difficultyLabel('impossible', 4)).toBe('Hard');
		expect(difficultyLabel('impossible', 5)).toBe('Hard');
	});
});

describe('boardEmoji', () => {
	it('draws 3×3 boards as rows of emoji', () => {
		expect(boardEmoji(cells('XXXOO....'))).toBe('❌❌❌\n⭕⭕⬜\n⬜⬜⬜');
	});

	it('draws bigger boards too', () => {
		expect(boardEmoji(cells('XO..............'))).toBe('❌⭕⬜⬜\n⬜⬜⬜⬜\n⬜⬜⬜⬜\n⬜⬜⬜⬜');
		const five = boardEmoji(Array(25).fill(''));
		expect(five.split('\n')).toHaveLength(5);
		expect(five.split('\n')[0]).toBe('⬜⬜⬜⬜⬜');
	});
});

describe('resultText', () => {
	const base = { vsAi: true, human: 'X', difficulty: 'impossible', rules: 'classic', size: 3, cells: cells('XXXOO....'), url };

	it('brags about a win, with the board and the link', () => {
		const text = resultText({ ...base, result: win });
		expect(text).toBe(`I beat the Impossible TicTacToe AI ⭕❌\n❌❌❌\n⭕⭕⬜\n⬜⬜⬜\nThink you can do better? ${url}`);
	});

	it('mentions endless mode and the size of a big board, with its emoji board', () => {
		const text = resultText({ ...base, result: win, rules: 'endless', size: 4, cells: cells('XXXXOO..........') });
		expect(text).toBe(
			`I beat the Hard TicTacToe AI in Endless mode ⭕❌ (4×4)\n❌❌❌❌\n⭕⭕⬜⬜\n⬜⬜⬜⬜\n⬜⬜⬜⬜\nThink you can do better? ${url}`,
		);
	});

	it('is honest about losing and drawing', () => {
		expect(resultText({ ...base, result: { player: 'O', line: [] }, difficulty: 'medium' })).toMatch(/^The Medium TicTacToe AI got me this time/);
		expect(resultText({ ...base, result: draw })).toMatch(/^I held the Impossible TicTacToe AI to a draw/);
	});

	it('works from the human’s side when playing O', () => {
		expect(resultText({ ...base, human: 'O', result: { player: 'O', line: [] } })).toMatch(/^I beat the/);
		expect(resultText({ ...base, human: 'O', result: win })).toMatch(/^The Impossible TicTacToe AI got me/);
	});

	it('describes two-player games without an AI', () => {
		expect(resultText({ ...base, vsAi: false, result: win })).toMatch(/^X won a game of 2-player TicTacToe/);
		expect(resultText({ ...base, vsAi: false, result: draw })).toMatch(/^Our TicTacToe game ended in a draw/);
	});
});
