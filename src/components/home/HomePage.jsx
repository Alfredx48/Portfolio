import { createSignal, onCleanup, onMount } from 'solid-js';
import Intro from './Intro';
import About from './About';
import Projects from './Projects';
import Playground from './Playground';
import Blob from './Blob';
import './home.css';

function HomePage() {
	const [activeSection, setActiveSection] = createSignal('about');

	onMount(() => {
		document.title = 'Alfred Shaheen';

		// Highlight the nav item for whichever section is crossing the upper third of the screen
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActiveSection(entry.target.id);
				}
			},
			{ rootMargin: '-30% 0px -60% 0px' },
		);
		document.querySelectorAll('.section').forEach((section) => observer.observe(section));
		onCleanup(() => observer.disconnect());
	});

	return (
		<>
			<div class="home">
				<Intro activeSection={activeSection()} />
				<div class="content">
					<About />
					<Projects />
					<Playground />
					<footer class="site-footer">
						© {new Date().getFullYear()} Alfred Shaheen · Built with SolidJS and Vite
					</footer>
				</div>
			</div>
			<Blob />
		</>
	);
}

export default HomePage;
