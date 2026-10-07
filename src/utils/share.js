import { toast } from './toast';

// Opens the share sheet where there is one, otherwise copies the text. Never throws.
export async function shareResult(text) {
	try {
		if (navigator.share) {
			await navigator.share({ text });
		} else {
			await navigator.clipboard.writeText(text);
			toast('Copied to clipboard', 'info');
		}
	} catch (error) {
		// Closing the share sheet isn't a failure
		if (error?.name === 'AbortError') return;
		toast("Couldn't copy that", 'error');
	}
}
