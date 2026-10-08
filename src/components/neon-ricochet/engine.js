export const WIDTH = 800;
export const HEIGHT = 520;
export const COLORS = ['#ff728b', '#b994ff', '#6de0ec', '#c0f58b', '#ffd37a', '#82aaff'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Each glyph is a brick: 1 = glass, 2/3 = armor, * = an explosive reactor.
// The gaps are deliberate aiming lanes, including in the later sectors.
export const LEVELS = [
	{ name: 'First Light', subtitle: 'Find your rhythm in the neon grid.', color: '#6de0ec', layout: ['..1111..', '.111111.', '11111111', '.111111.'] },
	{ name: 'Prism Garden', subtitle: 'Thread the gaps between the prisms.', color: '#c0f58b', layout: ['1.1..1.1', '.121121.', '11.11.11', '.111111.', '..1111..'] },
	{ name: 'Crossfire', subtitle: 'Chain the glowing reactor bricks.', color: '#ff728b', layout: ['1..11..1', '.1.11.1.', '..1**1..', '.1.11.1.', '1..11..1'] },
	{ name: 'Circuit Breaker', subtitle: 'Break the armor. Challenge the Prism Warden.', color: '#b994ff', layout: ['222..222', '1.1..1.1', '11*11*11', '.121121.', '111..111'] },
	{ name: 'Twin Towers', subtitle: 'Send a shot up either neon tower.', color: '#82aaff', layout: ['.22..22.', '.11..11.', '.2*..*2.', '.11..11.', '12211221', '11....11'] },
	{ name: 'Reactor Core', subtitle: 'One spark can unravel the whole core.', color: '#ffd37a', layout: ['..2222..', '.21**12.', '21*33*12', '21*33*12', '.21**12.', '..1111..'] },
	{ name: 'Starfall', subtitle: 'Make your own constellation of combos.', color: '#6de0ec', layout: ['*...3..*', '.2.121..', '..2*2...', '32111223', '..2*2...', '.1.121..', '*...2..*'] },
	{ name: 'Gravity Well', subtitle: 'Dodge the Void Sentinel’s telegraphed volleys.', color: '#b994ff', layout: ['.233332.', '21....12', '2*....*2', '21....12', '.211112.', '..1**1..'] },
	{ name: 'Crystal Vault', subtitle: 'A reinforced vault with fragile seams.', color: '#c0f58b', layout: ['333..333', '2*2112*2', '21.22.12', '12.**.21', '21.22.12', '2*2112*2', '111..111'] },
	{ name: 'Supernova', subtitle: 'Light the fuse in a star made of armor.', color: '#ff728b', layout: ['3..**..3', '.2.22.2.', '..3**3..', '**2**2**', '..3**3..', '.2.22.2.', '1..11..1'] },
	{ name: 'Signal Storm', subtitle: 'Break through the shifting pattern of lanes.', color: '#82aaff', layout: ['3*3.3*3.', '.212.212', '22.**.22', '*3.33.3*', '22.**.22', '212.212.', '.1*1.1*1'] },
	{ name: 'Neon Crown', subtitle: 'The Neon Sovereign guards the final signal.', color: '#ffd37a', layout: ['3..33..3', '32*33*23', '.233332.', '..3**3..', '.23**32.', '12*22*21', '111..111'] },
];
export const SECTORS = LEVELS.length;
export const POWERUPS = {
	wide: { name: 'Stretch', glyph: '↔', color: '#c0f58b', description: 'A wider paddle for 12 seconds.', duration: 12 },
	slow: { name: 'Time Warp', glyph: '◷', color: '#b994ff', description: 'Slow every ball for 9 seconds.', duration: 9 },
	shield: { name: 'Safety Net', glyph: '⌒', color: '#6de0ec', description: 'Save one falling ball or absorb one hostile shot.' },
	multiball: { name: 'Split Signal', glyph: '✣', color: '#ff728b', description: 'Split into up to three balls. Keep any one alive.' },
	laser: { name: 'Pulse Cannons', glyph: '↑', color: '#ffd37a', description: 'Your paddle fires twin lasers for 10 seconds.', duration: 10 },
	fire: { name: 'Fireball', glyph: '✦', color: '#ff935a', description: 'Pierce bricks and melt armor for 8 seconds.', duration: 8 },
	magnet: { name: 'Magnetic Grip', glyph: '⊂', color: '#82aaff', description: 'Catch balls for 10 seconds; launch to aim again.', duration: 10 },
	life: { name: 'Extra Life', glyph: '♥', color: '#ff82b8', description: 'Recover one life, up to a maximum of five.' },
};

export const MODES = {
	campaign: { name: 'Campaign', description: 'Twelve sectors, five upgrade drafts, and three boss encounters.', route: Array.from({ length: 12 }, (_, i) => i + 1) },
	bossrush: { name: 'Boss Rush', description: 'Face all three bosses immediately, with an upgrade draft between fights.', route: [4, 8, 12] },
};
export const SHIPS = {
	courier: { name: 'Courier', glyph: '◇', color: '#6de0ec', description: 'The balanced original. Three lives, steady handling.', lives: 3, width: 116, chargeRate: 1, speed: 1 },
	bulwark: { name: 'Bulwark', glyph: '⬡', color: '#c0f58b', description: 'Four lives, a wider paddle, and slower balls.', lives: 4, width: 136, chargeRate: 1, speed: 0.9 },
	interceptor: { name: 'Interceptor', glyph: '△', color: '#ff728b', description: 'Two lives, a narrow paddle, and 45% faster Nova charge.', lives: 2, width: 100, chargeRate: 1.45, speed: 1.05 },
};
export const UPGRADES = {
	plating: { name: 'Titanium Rails', glyph: '↔', color: '#c0f58b', description: 'Add 14 pixels to your base paddle width.', maxStacks: 3 },
	fortune: { name: 'Bounty Matrix', glyph: '✧', color: '#ffd37a', description: 'Earn 15% more points from every source.', maxStacks: 3 },
	capacitor: { name: 'Flux Capacitor', glyph: 'ϟ', color: '#6de0ec', description: 'Charge Nova Pulse 20% faster.', maxStacks: 3 },
	tractor: { name: 'Gravity Collector', glyph: '◎', color: '#b994ff', description: 'Pull nearby falling powers toward your paddle.', maxStacks: 3 },
	overclock: { name: 'Time Dilation', glyph: '◷', color: '#82aaff', description: 'Make timed powers last 20% longer.', maxStacks: 3 },
	aegis: { name: 'Aegis Protocol', glyph: '⌒', color: '#6de0ec', description: 'Start every new sector with one shield.', maxStacks: 1 },
	piercer: { name: 'Armor-Piercing Rounds', glyph: '↑', color: '#ff935a', description: 'Lasers deal one extra damage to armored bricks.', maxStacks: 2 },
	thrusters: { name: 'Vector Thrusters', glyph: '»', color: '#ff82b8', description: 'Move your paddle 20% faster.', maxStacks: 2 },
};
const BOSS_SPECS = {
	4: { name: 'Prism Warden', color: '#b994ff', hp: 18, w: 142 },
	8: { name: 'Void Sentinel', color: '#82aaff', hp: 26, w: 160 },
	12: { name: 'Neon Sovereign', color: '#ffd37a', hp: 34, w: 178 },
};
const upgradeCount = (run, id) => run.upgrades[id] || 0;
const baseWidth = run => SHIPS[run.ship].width + upgradeCount(run, 'plating') * 14;

function addScore(run, points) { run.score += Math.round(points * (1 + upgradeCount(run, 'fortune') * 0.15)); }
function charge(run, amount) {
	run.energy = Math.min(100, run.energy + amount * SHIPS[run.ship].chargeRate * (1 + upgradeCount(run, 'capacitor') * 0.2));
}
function bossFor(sector) {
	const spec = BOSS_SPECS[sector];
	return spec ? { ...spec, x: (WIDTH - spec.w) / 2, y: 72, h: 44, maxHp: spec.hp, phase: 'patrol', flash: 0, telegraph: 0, targetX: WIDTH / 2, clock: 0, attackClock: 4.2, volley: 0 } : null;
}
function bumpersFor(sector) {
	if (![3, 5, 7, 9, 11].includes(sector)) return [];
	return [
		{ id: 0, x: 210, baseX: 210, y: 344, radius: 16, color: LEVELS[sector - 1].color, offset: 0 },
		{ id: 1, x: 590, baseX: 590, y: 370, radius: 16, color: '#b994ff', offset: Math.PI },
	];
}
function prepareSector(run) {
	run.bricks = bricksFor(run.sector);
	run.boss = bossFor(run.sector);
	run.bumpers = bumpersFor(run.sector);
	run.enemyShots = [];
	run.shockwaves = [];
	if (upgradeCount(run, 'aegis')) run.shield = 1;
}

const DROP_ORDER = ['multiball', 'wide', 'laser', 'shield', 'fire', 'slow', 'magnet', 'life'];
const BALL_R = 8;
const PADDLE_Y = HEIGHT - 42;
const MAX_BALLS = 3;
const TIMERS = ['wide', 'slow', 'laser', 'fire', 'magnet'];

function bricksFor(sector) {
	const bricks = [];
	const level = LEVELS[sector - 1];
	for (let row = 0; row < level.layout.length; row++) {
		for (let col = 0; col < 8; col++) {
			const glyph = level.layout[row][col];
			if (!glyph || glyph === '.') continue;
			const kind = glyph === '*' ? 'blast' : glyph === '1' ? 'normal' : 'armor';
			const hp = kind === 'blast' ? 1 : Number(glyph);
			bricks.push({ id: row * 8 + col, x: 38 + col * 92, y: (BOSS_SPECS[sector] ? 150 : 66) + row * 32, w: 80, h: 22, hp, maxHp: hp, kind,
				color: kind === 'blast' ? '#ff935a' : COLORS[row % COLORS.length], points: (level.layout.length - row) * 10 + (hp - 1) * 15 });
		}
	}
	return bricks;
}

function newBall(x, offset = 0) {
	return { x, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0, held: true, offset, trail: [] };
}

export function createRun({ ship = 'courier', mode = 'campaign' } = {}) {
	if (!Object.hasOwn(SHIPS, ship)) ship = 'courier';
	if (!Object.hasOwn(MODES, mode)) mode = 'campaign';
	const ball = newBall(WIDTH / 2);
	const run = {
		phase: 'ready', sector: MODES[mode].route[0], mode, stage: 1, stageTotal: MODES[mode].route.length, ship, score: 0, lives: SHIPS[ship].lives, combo: 0, maxCombo: 0, destroyed: 0,
		time: 0, paddle: { x: WIDTH / 2, target: WIDTH / 2, width: SHIPS[ship].width },
		ball, balls: [ball], bricks: [], drops: [], particles: [], lasers: [],
		wide: 0, slow: 0, shield: 0, laser: 0, fire: 0, magnet: 0,
		laserCooldown: 0, lastPower: null, powersCaught: 0, events: [],
		energy: 35, pulses: 0, bossesDefeated: 0, boss: null, enemyShots: [], bumpers: [], shockwaves: [],
		offers: [], upgrades: {}, drafts: 0,
	};
	prepareSector(run);
	return run;
}

function releaseBall(run, ball, index = 0) {
	const speed = Math.min(505, 340 + run.sector * 15) * SHIPS[run.ship].speed;
	const offset = clamp(ball.offset || 0, -run.paddle.width / 2, run.paddle.width / 2);
	const angle = clamp(offset / (run.paddle.width / 2) * 0.9 + (index - (run.balls.length - 1) / 2) * 0.2 + 0.18, -1.05, 1.05);
	ball.vx = Math.sin(angle) * speed;
	ball.vy = -Math.cos(angle) * speed;
	ball.held = false;
	ball.trail = [];
}

export function launch(run) {
	if (run.phase !== 'ready' && run.phase !== 'playing') return;
	for (let i = 0; i < run.balls.length; i++) if (run.balls[i].held) releaseBall(run, run.balls[i], i);
	run.phase = 'playing';
}

export function aim(run, x) {
	if (!Number.isFinite(x)) return;
	run.paddle.target = clamp(x, run.paddle.width / 2 + 8, WIDTH - run.paddle.width / 2 - 8);
}

function burst(run, x, y, color, count = 8) {
	for (let i = 0; i < count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 45 + Math.random() * 100;
		const life = 0.35 + Math.random() * 0.25;
		run.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 2 + Math.random() * 2, color });
	}
	run.particles = run.particles.slice(-180);
}

function clearPowers(run) {
	for (const timer of TIMERS) run[timer] = 0;
	run.shield = 0;
	run.lasers = [];
	run.drops = [];
	run.laserCooldown = 0;
	run.paddle.width = baseWidth(run);
	run.enemyShots = [];
	run.lastPower = null;
}

function resetBall(run) {
	run.phase = 'ready';
	run.combo = 0;
	const ball = newBall(run.paddle.x);
	run.balls = [ball];
	run.ball = ball;
}

function stabilize(ball) {
	const speed = clamp(Math.hypot(ball.vx, ball.vy), 320, 605);
	const direction = ball.vy >= 0 ? 1 : -1;
	const vx = clamp(ball.vx, -speed * 0.89, speed * 0.89);
	ball.vx = vx;
	ball.vy = direction * Math.sqrt(speed * speed - vx * vx);
}

// All damage paths go through this function, so chain reactions, fireballs,
// and lasers award a destroyed brick and its power drop exactly once.
function damageBrick(run, brick, damage = 1, gainCharge = true) {
	if (brick.hp <= 0) return;
	brick.hp = Math.max(0, brick.hp - damage);
	run.combo++;
	run.maxCombo = Math.max(run.maxCombo, run.combo);
	addScore(run, (brick.hp ? 5 : brick.points) * Math.min(run.combo, 8));
	if (gainCharge) charge(run, brick.hp ? 3 : 5);
	run.events.push('hit');
	burst(run, brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, brick.kind === 'blast' && !brick.hp ? 18 : 7);
	if (brick.hp) return;
	run.destroyed++;
	if (run.destroyed % 5 === 0) {
		const kind = DROP_ORDER[(run.destroyed / 5 - 1) % DROP_ORDER.length];
		run.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind });
	}
	if (brick.kind === 'blast') {
		const x = brick.x + brick.w / 2, y = brick.y + brick.h / 2;
		for (const neighbor of run.bricks) {
			if (neighbor.hp > 0 && Math.hypot(neighbor.x + neighbor.w / 2 - x, neighbor.y + neighbor.h / 2 - y) <= 112) damageBrick(run, neighbor, 2, gainCharge);
		}
	}
}

function applyPower(run, kind) {
	const power = POWERUPS[kind];
	if (!power) return;
	run.lastPower = kind;
	run.powersCaught++;
	if (power.duration) run[kind] = power.duration * (1 + upgradeCount(run, 'overclock') * 0.2);
	if (kind === 'shield') run.shield = 1;
	if (kind === 'life') run.lives = Math.min(5, run.lives + 1);
	if (kind === 'laser') run.laserCooldown = 0;
	if (kind === 'multiball' && run.balls.length < MAX_BALLS) {
		const source = run.balls.find(ball => !ball.held) || run.balls[0];
		const speed = Math.max(340 * SHIPS[run.ship].speed, Math.hypot(source.vx, source.vy));
		const angle = source.held ? -Math.PI / 2 : Math.atan2(source.vy, source.vx);
		let split = 0;
		while (run.balls.length < MAX_BALLS) {
			const spread = split++ % 2 ? 0.38 : -0.38;
			const ball = { x: source.x, y: source.y, vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed, held: false, trail: [] };
			stabilize(ball);
			run.balls.push(ball);
		}
	}
	run.events.push('power');
}

function overlaps(ball, brick) {
	const nearX = clamp(ball.x, brick.x, brick.x + brick.w), nearY = clamp(ball.y, brick.y, brick.y + brick.h);
	return (ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 <= BALL_R ** 2;
}

function reflectRectangle(ball, rect) {
	const overlapX = Math.min(ball.x + BALL_R - rect.x, rect.x + rect.w - ball.x + BALL_R);
	const overlapY = Math.min(ball.y + BALL_R - rect.y, rect.y + rect.h - ball.y + BALL_R);
	if (overlapX < overlapY) {
		ball.x = ball.x < rect.x + rect.w / 2 ? rect.x - BALL_R - 1 : rect.x + rect.w + BALL_R + 1;
		ball.vx *= -1;
	} else {
		ball.y = ball.y < rect.y + rect.h / 2 ? rect.y - BALL_R - 1 : rect.y + rect.h + BALL_R + 1;
		ball.vy *= -1;
	}
	stabilize(ball);
}
function damageBoss(run, damage, gainCharge = true) {
	const boss = run.boss;
	if (!boss || boss.hp <= 0) return;
	const actualDamage = Math.min(boss.hp, damage);
	boss.hp -= actualDamage;
	boss.flash = 0.15;
	addScore(run, 40 * actualDamage);
	if (gainCharge) charge(run, 4);
	run.events.push('boss-hit');
	burst(run, boss.x + boss.w / 2, boss.y + boss.h / 2, boss.color, 10);
	if (boss.hp <= 0) {
		addScore(run, 450 * run.sector);
		run.bossesDefeated++;
		run.enemyShots = [];
		boss.phase = 'defeated';
		boss.telegraph = 0;
		run.shockwaves.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h / 2, radius: 0, life: 0.75, maxLife: 0.75 });
		run.events.push('boss-defeated');
	}
}
function moveBumpers(run, dt) {
	for (const bumper of run.bumpers) {
		bumper.x = bumper.baseX + Math.sin(run.time * 0.7 + bumper.offset) * 65;
		bumper.flash = Math.max(0, (bumper.flash || 0) - dt);
	}
}
function bounceBumpers(run, ball, dt) {
	ball.bumpCooldown = Math.max(0, (ball.bumpCooldown || 0) - dt);
	for (const bumper of run.bumpers) {
		const dx = ball.x - bumper.x, dy = ball.y - bumper.y;
		const distance = Math.hypot(dx, dy);
		const radius = BALL_R + bumper.radius;
		if (distance >= radius) continue;
		const nx = distance > 0.001 ? dx / distance : 0, ny = distance > 0.001 ? dy / distance : -1;
		ball.x = bumper.x + nx * (radius + 1);
		ball.y = bumper.y + ny * (radius + 1);
		const dot = ball.vx * nx + ball.vy * ny;
		if (dot < 0) {
			ball.vx -= 2 * dot * nx;
			ball.vy -= 2 * dot * ny;
			stabilize(ball);
			if (!ball.bumpCooldown) {
				ball.bumpCooldown = 0.12;
				bumper.flash = 0.18;
				run.events.push('bump');
				burst(run, bumper.x, bumper.y, bumper.color, 5);
			}
		}
	}
}

function moveBall(run, ball, dt) {
	const paddle = run.paddle;
	if (ball.held) {
		ball.offset = clamp(ball.offset || 0, -paddle.width / 2 + BALL_R, paddle.width / 2 - BALL_R);
		ball.x = paddle.x + ball.offset;
		ball.y = PADDLE_Y - BALL_R - 2;
		return;
	}
	ball.bossCooldown = Math.max(0, (ball.bossCooldown || 0) - dt);
	const rate = run.slow > 0 ? 0.66 : 1;
	ball.trail.push({ x: ball.x, y: ball.y });
	if (ball.trail.length > 10) ball.trail.shift();
	ball.x += ball.vx * dt * rate;
	ball.y += ball.vy * dt * rate;
	if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
	if (ball.x > WIDTH - BALL_R) { ball.x = WIDTH - BALL_R; ball.vx = -Math.abs(ball.vx); }
	if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
	if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R <= PADDLE_Y + 14 && Math.abs(ball.x - paddle.x) <= paddle.width / 2 + BALL_R) {
		const offset = clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
		const angle = offset * 1.05;
		const speed = Math.min(605, Math.hypot(ball.vx, ball.vy) + 3);
		ball.vx = Math.sin(angle) * speed;
		ball.vy = -Math.cos(angle) * speed;
		ball.y = PADDLE_Y - BALL_R - 1;
		run.combo = 0;
		if (run.magnet > 0) {
			ball.held = true;
			ball.offset = ball.x - paddle.x;
			ball.vx = ball.vy = 0;
			ball.trail = [];
			run.events.push('caught');
			return;
		}
	}
	if (run.shield && ball.vy > 0 && ball.y >= HEIGHT - 18) {
		ball.y = HEIGHT - 19;
		ball.vy = -Math.abs(ball.vy);
		run.shield = 0;
		run.events.push('shield');
		burst(run, ball.x, ball.y, POWERUPS.shield.color, 18);
	}
	bounceBumpers(run, ball, dt);
	if (run.boss && run.boss.hp > 0 && overlaps(ball, run.boss)) {
		reflectRectangle(ball, run.boss);
		if (!ball.bossCooldown) { damageBoss(run, run.fire > 0 ? 2 : 1); ball.bossCooldown = 0.15; }
	}
	for (const brick of run.bricks) {
		if (brick.hp <= 0 || !overlaps(ball, brick)) continue;
		if (run.fire > 0) { damageBrick(run, brick, brick.hp); continue; }
		reflectRectangle(ball, brick);
		damageBrick(run, brick);
		break;
	}
}

function moveLasers(run, dt) {
	if (run.laser > 0) {
		run.laserCooldown -= dt;
		if (run.laserCooldown <= 0) {
			run.laserCooldown = 0.4;
			for (const side of [-1, 1]) run.lasers.push({ x: run.paddle.x + side * (run.paddle.width / 2 - 12), y: PADDLE_Y - 18, w: 4, h: 16 });
		}
	}
	for (const bolt of run.lasers) {
		const previousY = bolt.y;
		bolt.y -= 670 * dt;
		// Check from the paddle upward, so a beam strikes its nearest brick.
		for (let i = run.bricks.length - 1; i >= 0; i--) {
			const brick = run.bricks[i];
			if (brick.hp <= 0 || bolt.x + bolt.w / 2 < brick.x || bolt.x - bolt.w / 2 > brick.x + brick.w) continue;
			if (bolt.y <= brick.y + brick.h && previousY + bolt.h >= brick.y) {
				damageBrick(run, brick, 1 + upgradeCount(run, 'piercer'));
				bolt.spent = true;
				break;
			}
		}
		const boss = run.boss;
		if (!bolt.spent && boss && boss.hp > 0 && bolt.x + bolt.w / 2 >= boss.x && bolt.x - bolt.w / 2 <= boss.x + boss.w && bolt.y <= boss.y + boss.h && previousY + bolt.h >= boss.y) {
			damageBoss(run, 1);
			bolt.spent = true;
		}
	}
	run.lasers = run.lasers.filter(bolt => !bolt.spent && bolt.y + bolt.h >= 0);
}

function draftUpgrades(run) {
	const order = Object.keys(UPGRADES);
	const eligible = order.filter(id => upgradeCount(run, id) < UPGRADES[id].maxStacks);
	const start = (run.drafts * 3) % eligible.length;
	run.offers = [0, 1, 2].map(offset => eligible[(start + offset) % eligible.length]);
	run.drafts++;
	run.phase = 'upgrade';
}
export function chooseUpgrade(run, id) {
	if (run.phase !== 'upgrade' || !run.offers.includes(id) || !Object.hasOwn(UPGRADES, id) || upgradeCount(run, id) >= UPGRADES[id].maxStacks) return false;
	run.upgrades[id] = upgradeCount(run, id) + 1;
	run.paddle.width = baseWidth(run);
	if (id === 'aegis') run.shield = 1;
	run.offers = [];
	run.phase = 'ready';
	run.events.push('upgrade-chosen');
	return true;
}
function sectorCleared(run) { return run.bricks.every(brick => brick.hp <= 0) && (!run.boss || run.boss.hp <= 0); }
function finishSector(run) {
	const completed = run.sector;
	addScore(run, 300 * completed);
	clearPowers(run);
	if (run.stage === run.stageTotal) { run.phase = 'won'; run.events.push('won'); return; }
	if (run.mode === 'bossrush' || completed % 3 === 0) run.lives = Math.min(5, run.lives + 1);
	run.stage++;
	run.sector = MODES[run.mode].route[run.stage - 1];
	prepareSector(run);
	run.particles = [];
	resetBall(run);
	run.events.push('sector');
	if ([2, 4, 6, 8, 10].includes(completed)) draftUpgrades(run);
}
export function pulse(run) {
	if (run.phase !== 'playing' || run.energy < 100) return false;
	run.energy = 0;
	run.pulses++;
	run.enemyShots = [];
	run.shockwaves.push({ x: run.paddle.x, y: PADDLE_Y, radius: 0, life: 0.8, maxLife: 0.8 });
	run.events.push('pulse');
	for (const brick of run.bricks) if (brick.hp > 0) damageBrick(run, brick, 1, false);
	damageBoss(run, 5, false);
	if (sectorCleared(run)) finishSector(run);
	return true;
}
function loseLife(run, hazard = false) {
	if (run.phase !== 'playing') return;
	run.lives--;
	clearPowers(run);
	resetBall(run);
	if (run.boss && run.boss.hp > 0) { run.boss.attackClock = 4.2; run.boss.phase = 'patrol'; run.boss.telegraph = 0; }
	if (hazard) run.events.push('hazard');
	if (run.lives <= 0) { run.phase = 'over'; run.events.push('over'); }
	else run.events.push('lost');
}
function moveBoss(run, dt) {
	const boss = run.boss;
	if (!boss || boss.hp <= 0) return;
	const enraged = boss.hp <= boss.maxHp / 2;
	boss.clock += dt * (enraged ? 1.5 : 1);
	boss.flash = Math.max(0, boss.flash - dt);
	boss.x = (WIDTH - boss.w) / 2 + Math.sin(boss.clock * 0.6) * (240 - boss.w / 4);
	boss.attackClock -= dt;
	if (boss.attackClock <= 0.9) {
		if (boss.phase !== 'charging') boss.targetX = run.paddle.x;
		boss.phase = 'charging';
		boss.telegraph = clamp(1 - boss.attackClock / 0.9, 0, 1);
	}
	if (boss.attackClock <= 0) {
		const originX = boss.x + boss.w / 2, originY = boss.y + boss.h + 5;
		const count = run.sector >= 8 ? 5 : 3;
		const speed = 180 + run.sector * 5;
		const angle = Math.atan2(PADDLE_Y - originY, boss.targetX - originX);
		for (let i = 0; i < count; i++) {
			const spread = (i - (count - 1) / 2) * 0.16;
			run.enemyShots.push({ x: originX, y: originY, vx: Math.cos(angle + spread) * speed, vy: Math.max(90, Math.sin(angle + spread) * speed), radius: 6, color: boss.color });
		}
		boss.volley++;
		boss.attackClock = enraged ? 3.2 : 4.2;
		boss.phase = 'patrol';
		boss.telegraph = 0;
		run.events.push('volley');
	}
}
function moveEnemyShots(run, dt) {
	for (const shot of run.enemyShots) {
		shot.x += shot.vx * dt;
		shot.y += shot.vy * dt;
		if (shot.y + shot.radius >= PADDLE_Y && shot.y - shot.radius <= PADDLE_Y + 14 && Math.abs(shot.x - run.paddle.x) <= run.paddle.width / 2 + shot.radius) {
			shot.spent = true;
			if (run.shield) {
				run.shield = 0;
				run.events.push('shield');
				burst(run, shot.x, shot.y, POWERUPS.shield.color, 14);
			} else {
				loseLife(run, true);
				return true;
			}
		}
	}
	run.enemyShots = run.enemyShots.filter(shot => !shot.spent && shot.y < HEIGHT + 20 && shot.x > -20 && shot.x < WIDTH + 20);
	return false;
}

function step(run, dt, direction) {
	if (run.phase === 'upgrade') return;
	for (const particle of run.particles) {
		particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt;
	}
	run.particles = run.particles.filter(particle => particle.life > 0);
	for (const wave of run.shockwaves) { wave.radius += 900 * dt; wave.life -= dt; }
	run.shockwaves = run.shockwaves.filter(wave => wave.life > 0);
	if (run.phase === 'won' || run.phase === 'over') return;
	const paddle = run.paddle;
	if (direction) aim(run, paddle.target + direction * 700 * dt * (1 + upgradeCount(run, 'thrusters') * 0.2));
	paddle.width = baseWidth(run) + (run.wide > 0 ? 64 : 0);
	paddle.target = clamp(paddle.target, paddle.width / 2 + 8, WIDTH - paddle.width / 2 - 8);
	paddle.x += clamp(paddle.target - paddle.x, -1000 * dt * (1 + upgradeCount(run, 'thrusters') * 0.2), 1000 * dt * (1 + upgradeCount(run, 'thrusters') * 0.2));
	paddle.x = clamp(paddle.x, paddle.width / 2 + 8, WIDTH - paddle.width / 2 - 8);
	if (run.phase === 'ready') {
		for (const ball of run.balls) moveBall(run, ball, dt);
		return;
	}
	if (run.phase !== 'playing') return;
	run.time += dt;
	moveBoss(run, dt);
	moveBumpers(run, dt);
	const hadMagnet = run.magnet > 0;
	for (const timer of TIMERS) run[timer] = Math.max(0, run[timer] - dt);
	if (hadMagnet && run.magnet === 0) for (let i = 0; i < run.balls.length; i++) if (run.balls[i].held) releaseBall(run, run.balls[i], i);
	for (const drop of run.drops) {
		drop.y += 110 * dt;
		const attraction = upgradeCount(run, 'tractor');
		if (attraction && drop.y > PADDLE_Y - (100 + attraction * 35) && Math.abs(drop.x - paddle.x) < 100 + attraction * 60) drop.x += clamp(paddle.x - drop.x, -150 * attraction * dt, 150 * attraction * dt);
		if (drop.y >= PADDLE_Y - 12 && drop.y <= PADDLE_Y + 18 && Math.abs(drop.x - paddle.x) < paddle.width / 2 + 12) {
			applyPower(run, drop.kind);
			drop.caught = true;
			burst(run, drop.x, drop.y, POWERUPS[drop.kind].color, 14);
		}
	}
	run.drops = run.drops.filter(drop => !drop.caught && drop.y < HEIGHT + 20);
	for (const ball of run.balls) moveBall(run, ball, dt);
	moveLasers(run, dt);
	if (sectorCleared(run)) { finishSector(run); return; }
	if (moveEnemyShots(run, dt)) return;
	const surviving = run.balls.filter(ball => ball.held || ball.y <= HEIGHT + BALL_R);
	if (!surviving.length) {
		loseLife(run);
	} else {
		run.balls = surviving;
		run.ball = surviving[0];
	}
}

export function advanceRun(run, seconds, direction = 0) {
	run.events = [];
	if (!Number.isFinite(seconds) || seconds <= 0) return run.events;
	const dt = clamp(seconds, 0, 0.05);
	const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
	const movement = Number.isFinite(direction) ? clamp(direction, -1, 1) : 0;
	for (let i = 0; i < steps; i++) step(run, dt / steps, movement);
	return run.events;
}
