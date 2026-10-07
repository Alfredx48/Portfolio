import { emptyCells, getResult, linesFor, other, sizeOf } from './logic';

export function orbitRing(size) {
	const ring = [];
	for (let c = 0; c < size; c++) ring.push(c);
	for (let r = 1; r < size; r++) ring.push(r * size + size - 1);
	for (let c = size - 2; c >= 0; c--) ring.push((size - 1) * size + c);
	for (let r = size - 2; r > 0; r--) ring.push(r * size);
	return ring;
}
export function rotateBoard(cells) {
	const ring = orbitRing(sizeOf(cells)), next = [...cells];
	ring.forEach((index, n) => next[ring[(n + 1) % ring.length]] = cells[index]);
	return next;
}
export function orbitOutcome(cells) {
	const winners = new Set(linesFor(sizeOf(cells)).filter(line => cells[line[0]] && line.every(i => cells[i] === cells[line[0]])).map(line => cells[line[0]]));
	return winners.size > 1 ? { player: null, line: [], simultaneous: true } : getResult(cells);
}
function afterMove(cells, index, mark, rotate) {
	const next = cells.map((cell, i) => i === index ? mark : cell);
	return rotate && !getResult(next)?.player ? rotateBoard(next) : next;
}
function positionValue(cells, me) {
	let score = 0;
	for (const line of linesFor(sizeOf(cells))) {
		const own = line.filter(i => cells[i] === me).length, enemy = line.filter(i => cells[i] === other(me)).length;
		if (!enemy) score += own ** 3;
		if (!own) score -= enemy ** 3;
	}
	return score;
}
// Orbit changes future geometry, so it uses its own heuristic AI rather than claiming perfect classic play.
export function chooseOrbitMove(cells, me, difficulty, rotateNext, random = Math.random) {
	const free = emptyCells(cells);
	if (!free.length) return null;
	if (difficulty === 'easy') return free[Math.floor(random() * free.length)];
	let best = -Infinity, move = free[0];
	for (const index of free) {
		const after = afterMove(cells, index, me, rotateNext), result = orbitOutcome(after);
		let value = result?.player === me ? 10000 : result?.player ? -10000 : positionValue(after, me);
		if (!result) for (const reply of emptyCells(after)) {
			const child = afterMove(after, reply, other(me), !rotateNext);
			if (orbitOutcome(child)?.player === other(me)) value -= 2000;
		}
		value += random() * (difficulty === 'medium' ? 30 : 3);
		if (value > best) { best = value; move = index; }
	}
	return move;
}
