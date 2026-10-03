const COLORS = ['#4fd1c5', '#8042fb', '#48fcc0', '#f472b6', '#facc15', '#c4b5fd', '#60a5fa'];
const GRAVITY = 900; // px/s²
const DURATION_MS = 3500;

// Fires a burst of confetti from (x, y) on a temporary full-screen canvas.
export function confetti({ x = window.innerWidth / 2, y = window.innerHeight / 3, count = 140, power = 1 } = {}) {
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const dpr = window.devicePixelRatio || 1;
	canvas.className = 'confetti-canvas';
	canvas.width = window.innerWidth * dpr;
	canvas.height = window.innerHeight * dpr;
	ctx.scale(dpr, dpr);
	document.body.append(canvas);

	const particles = Array.from({ length: count }, () => {
		// Mostly upward, fanned out to either side
		const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
		const speed = (350 + Math.random() * 550) * power;
		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			size: 5 + Math.random() * 6,
			spin: (Math.random() - 0.5) * 12,
			angle: Math.random() * Math.PI,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
		};
	});

	const start = performance.now();
	let last = start;

	const frame = (now) => {
		const dt = Math.min((now - last) / 1000, 1 / 30);
		last = now;
		const fade = Math.max(0, 1 - (now - start) / DURATION_MS);

		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
		ctx.globalAlpha = fade;
		for (const p of particles) {
			p.vx *= 0.99;
			p.vy = p.vy * 0.99 + GRAVITY * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.angle += p.spin * dt;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
			ctx.restore();
		}

		if (fade > 0) requestAnimationFrame(frame);
		else canvas.remove();
	};
	requestAnimationFrame(frame);
}
