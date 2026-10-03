import { onCleanup, onMount } from 'solid-js';

// How far the blob closes the gap to the cursor each frame (0–1). Lower trails more.
const EASE = 0.1;

// Follows the cursor with a little lag. The eased position is written to the
// --x / --y custom properties so the hidden links' spotlight moves with the blob.
function Blob() {
	onMount(() => {
		const root = document.documentElement;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const pos = { ...target };
		let frame = 0;

		const apply = () => {
			root.style.setProperty('--x', `${pos.x}px`);
			root.style.setProperty('--y', `${pos.y}px`);
		};

		const tick = () => {
			pos.x += (target.x - pos.x) * EASE;
			pos.y += (target.y - pos.y) * EASE;
			apply();
			const settled = Math.abs(target.x - pos.x) < 0.5 && Math.abs(target.y - pos.y) < 0.5;
			frame = settled ? 0 : requestAnimationFrame(tick);
		};

		const handlePointerMove = (e) => {
			target.x = e.clientX;
			target.y = e.clientY;
			if (reducedMotion.matches) {
				Object.assign(pos, target);
				apply();
			} else if (!frame) {
				frame = requestAnimationFrame(tick);
			}
		};

		apply();
		window.addEventListener('pointermove', handlePointerMove, { passive: true });

		onCleanup(() => {
			window.removeEventListener('pointermove', handlePointerMove);
			cancelAnimationFrame(frame);
		});
	});

	return <div class="blob" aria-hidden="true" />;
}

export default Blob;
