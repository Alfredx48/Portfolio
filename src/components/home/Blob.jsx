import { onCleanup, onMount } from 'solid-js';

// How far the blob closes the gap to the cursor each frame (0–1). Lower trails more.
const EASE = 0.1;

// Follows the cursor with a little lag. The eased position goes to --x / --y for the
// blob, and to --sx / --sy on each hidden link for its spotlight.
// (Touch screens don't get the blob or the hidden links; see home.css.)
function Blob() {
	onMount(() => {
		const root = document.documentElement;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const links = [...document.querySelectorAll('.secret-link')];
		const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const pos = { ...target };
		let frame = 0;

		// The spotlight is positioned in each link's own coordinates. A viewport-fixed
		// background would be simpler, but Safari doesn't support background-attachment: fixed everywhere.
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

		const handlePointerMove = (e) => {
			if (e.pointerType === 'touch') return;
			target.x = e.clientX;
			target.y = e.clientY;
			if (reducedMotion.matches) {
				Object.assign(pos, target);
				apply();
			} else if (!frame) {
				frame = requestAnimationFrame(tick);
			}
		};

		// Links that scroll under a still cursor (narrow windows) need their spotlight moved too
		const handleScroll = () => apply();

		apply();
		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('scroll', handleScroll, { passive: true });

		onCleanup(() => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('scroll', handleScroll);
			cancelAnimationFrame(frame);
		});
	});

	return <div class="blob" aria-hidden="true" />;
}

export default Blob;
