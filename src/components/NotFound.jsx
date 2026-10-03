import { A } from '@solidjs/router';
import { onMount } from 'solid-js';

function NotFound() {
	onMount(() => (document.title = 'Not found | Alfred Shaheen'));

	return (
		<section class="page">
			<h1 class="page-title">Page not found</h1>
			<p>There's nothing at this address.</p>
			<A href="/" class="btn">
				Back home
			</A>
		</section>
	);
}

export default NotFound;
