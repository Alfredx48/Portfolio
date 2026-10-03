import { onCleanup, onMount } from 'solid-js';

// How far the blob closes the gap to the cursor each frame (0–1). Lower trails more.
const EASE = 0.1;

// Follows the cursor with a little lag, or your finger on touch screens (while
// touching or scrolling). The eased position goes to --x / --y for the blob, and to
// --sx / --sy on each hidden link for its spotlight.
function Blob() {
	onMount(() => {
		const root = document.documentElement;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const links = [...document.querySelectorAll('.secret-link')];
		const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const pos = { ...target };
		let frame = 0;

		// The spotlight is positioned in each link's own coordinates. A viewport-fixed
		// background would be simpler, but iOS Safari ignores background-attachment: fixed.
		const apply = () => {
			const rects = links.map((link) => link.getBoundingClientRect()); // read before writing
			root.style.setProperty('--x', `${pos.x}px`);
			root.style.setProperty('--y', `${pos.y}px`);
			links.forEach((link, i) => {
				link.style.setProperty('--sx', `${pos.x - rects[i].left}px`);
				link.style.setProperty('--sy', `${pos.y - rects[i].top}px`);
			});
		};

		const tick = () => {
			pos.x += (target.x - pos.x) * EASE;
			pos.y += (target.y - pos.y) * EASE;
			apply();
			const settled = Math.abs(target.x - pos.x) < 0.5 && Math.abs(target.y - pos.y) < 0.5;
			frame = settled ? 0 : requestAnimationFrame(tick);
		};

		const moveTo = (x, y, jump = false) => {
			target.x = x;
			target.y = y;
			if (jump || reducedMotion.matches) {
				Object.assign(pos, target);
				apply();
			} else if (!frame) {
				frame = requestAnimationFrame(tick);
			}
		};

		const handlePointerMove = (e) => {
			if (e.pointerType !== 'touch') moveTo(e.clientX, e.clientY);
		};

		// On touch screens the blob appears under your finger and only while you're touching
		// (the `touching` class fades it in), so scrolling past the intro is how you find them.
		const handleTouchStart = (e) => {
			root.classList.add('touching');
			moveTo(e.touches[0].clientX, e.touches[0].clientY, true);
		};
		const handleTouchMove = (e) => moveTo(e.touches[0].clientX, e.touches[0].clientY);
		const handleTouchEnd = (e) => {
			if (e.touches.length === 0) root.classList.remove('touching');
		};

		// Links that scroll under a still cursor need their spotlight moved too
		const handleScroll = () => apply();

		apply();
		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('touchstart', handleTouchStart, { passive: true });
		window.addEventListener('touchmove', handleTouchMove, { passive: true });
		window.addEventListener('touchend', handleTouchEnd, { passive: true });
		window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
		window.addEventListener('scroll', handleScroll, { passive: true });

		onCleanup(() => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('touchstart', handleTouchStart);
			window.removeEventListener('touchmove', handleTouchMove);
			window.removeEventListener('touchend', handleTouchEnd);
			window.removeEventListener('touchcancel', handleTouchEnd);
			window.removeEventListener('scroll', handleScroll);
			root.classList.remove('touching');
			cancelAnimationFrame(frame);
		});
	});

	return <div class="blob" aria-hidden="true" />;
}

export default Blob;
