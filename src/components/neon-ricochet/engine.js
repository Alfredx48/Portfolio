export const WIDTH = 800;
export const HEIGHT = 520;
export const SECTORS = 5;
export const COLORS = ['#ff728b', '#b994ff', '#6de0ec', '#c0f58b'];
const BALL_R = 8;
const PADDLE_Y = HEIGHT - 42;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function bricksFor(sector) {
	const bricks = [];
	for (let row = 0; row < 4; row++) {
		for (let col = 0; col < 8; col++) {
			if (sector === 2 && (row + col) % 3 === 0) continue;
			if (sector === 4 && row === 0 && col > 1 && col < 6) continue;
			const hp = sector >= 3 && (row + col) % 2 === 0 ? 2 : 1;
			bricks.push({ x: 38 + col * 92, y: 74 + row * 32, w: 80, h: 22, hp, color: COLORS[row], points: (4 - row) * 10 });
		}
	}
	return bricks;
}

export function createRun() {
	return {
		phase: 'ready', sector: 1, score: 0, lives: 3, combo: 0, maxCombo: 0, destroyed: 0,
		time: 0, paddle: { x: WIDTH / 2, target: WIDTH / 2, width: 116 },
		ball: { x: WIDTH / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0 },
		bricks: bricksFor(1), drops: [], particles: [], wide: 0, slow: 0, shield: 0, events: [],
	};
}

export function launch(run) {
	if (run.phase !== 'ready') return;
	const speed = 345 + run.sector * 24;
	run.ball.vx = speed * 0.3;
	run.ball.vy = -Math.sqrt(speed * speed - run.ball.vx * run.ball.vx);
	run.phase = 'playing';
}

export function aim(run, x) {
	run.paddle.target = clamp(x, run.paddle.width / 2 + 8, WIDTH - run.paddle.width / 2 - 8);
}

function burst(run, x, y, color) {
	for (let i = 0; i < 8; i++) {
		const angle = Math.random() * Math.PI * 2;
		run.particles.push({ x, y, vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90, life: 0.45, color });
	}
	run.particles = run.particles.slice(-80);
}

function resetBall(run) {
	run.phase = 'ready';
	run.combo = 0;
	run.ball = { x: run.paddle.x, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0 };
}

function step(run, dt, direction) {
	const paddle = run.paddle;
	if (direction) aim(run, paddle.target + direction * 700 * dt);
	paddle.width = run.wide > 0 ? 180 : 116;
	paddle.target = clamp(paddle.target, paddle.width / 2 + 8, WIDTH - paddle.width / 2 - 8);
	paddle.x += clamp(paddle.target - paddle.x, -1000 * dt, 1000 * dt);
	if (run.phase === 'ready') {
		run.ball.x = paddle.x;
		return;
	}
	if (run.phase !== 'playing') return;
	run.time += dt;
	run.wide = Math.max(0, run.wide - dt);
	run.slow = Math.max(0, run.slow - dt);
	for (const p of run.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
	run.particles = run.particles.filter(p => p.life > 0);
	for (const drop of run.drops) {
		drop.y += 105 * dt;
		if (drop.y >= PADDLE_Y - 12 && drop.y <= PADDLE_Y + 18 && Math.abs(drop.x - paddle.x) < paddle.width / 2 + 12) {
			if (drop.kind === 'wide') run.wide = 12;
			if (drop.kind === 'slow') run.slow = 9;
			if (drop.kind === 'shield') run.shield = 1;
			drop.caught = true;
			run.events.push('power');
			burst(run, drop.x, drop.y, '#c0f58b');
		}
	}
	run.drops = run.drops.filter(d => !d.caught && d.y < HEIGHT + 20);
	const b = run.ball, rate = run.slow > 0 ? 0.68 : 1;
	b.x += b.vx * dt * rate;
	b.y += b.vy * dt * rate;
	if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
	if (b.x > WIDTH - BALL_R) { b.x = WIDTH - BALL_R; b.vx = -Math.abs(b.vx); }
	if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
	if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + 14 && Math.abs(b.x - paddle.x) <= paddle.width / 2 + BALL_R) {
		const angle = clamp((b.x - paddle.x) / (paddle.width / 2), -1, 1) * 1.05;
		const speed = Math.min(570, Math.hypot(b.vx, b.vy) + 6);
		b.vx = Math.sin(angle) * speed;
		b.vy = -Math.cos(angle) * speed;
		b.y = PADDLE_Y - BALL_R - 1;
		run.combo = 0;
	}
	if (run.shield && b.vy > 0 && b.y >= HEIGHT - 18) {
		b.y = HEIGHT - 19;
		b.vy = -Math.abs(b.vy);
		run.shield = 0;
		run.events.push('power');
		burst(run, b.x, b.y, '#6de0ec');
	}
	for (const brick of run.bricks) {
		if (!brick.hp) continue;
		const nearX = clamp(b.x, brick.x, brick.x + brick.w), nearY = clamp(b.y, brick.y, brick.y + brick.h);
		if ((b.x - nearX) ** 2 + (b.y - nearY) ** 2 > BALL_R ** 2) continue;
		const overlapX = Math.min(b.x + BALL_R - brick.x, brick.x + brick.w - b.x + BALL_R);
		const overlapY = Math.min(b.y + BALL_R - brick.y, brick.y + brick.h - b.y + BALL_R);
		if (overlapX < overlapY) {
			b.x = b.x < brick.x + brick.w / 2 ? brick.x - BALL_R - 1 : brick.x + brick.w + BALL_R + 1;
			b.vx *= -1;
		} else {
			b.y = b.y < brick.y + brick.h / 2 ? brick.y - BALL_R - 1 : brick.y + brick.h + BALL_R + 1;
			b.vy *= -1;
		}
		brick.hp--;
		run.combo++;
		run.maxCombo = Math.max(run.maxCombo, run.combo);
		run.score += (brick.hp ? 5 : brick.points) * Math.min(run.combo, 8);
		run.events.push('hit');
		burst(run, b.x, b.y, brick.color);
		if (!brick.hp) {
			run.destroyed++;
			if (run.destroyed % 6 === 0) {
				const kind = ['wide', 'slow', 'shield'][(run.destroyed / 6 - 1) % 3];
				run.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind });
			}
		}
		break;
	}
	if (run.bricks.every(brick => !brick.hp)) {
		run.score += 300 * run.sector;
		if (run.sector === SECTORS) { run.phase = 'won'; run.events.push('won'); }
		else {
			run.sector++;
			run.bricks = bricksFor(run.sector);
			run.drops = [];
			run.particles = [];
			run.wide = run.slow = run.shield = 0;
			run.lives = Math.min(5, run.lives + 1);
			resetBall(run);
			run.events.push('sector');
		}
	} else if (b.y > HEIGHT + BALL_R) {
		run.lives--;
		run.drops = [];
		run.wide = run.slow = run.shield = 0;
		if (run.lives <= 0) { run.phase = 'over'; run.events.push('over'); }
		else { resetBall(run); run.events.push('lost'); }
	}
}

export function advanceRun(run, seconds, direction = 0) {
	run.events = [];
	const dt = clamp(seconds, 0, 0.05);
	const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
	for (let i = 0; i < steps; i++) step(run, dt / steps, direction);
	return run.events;
}
