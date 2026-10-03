import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

const backgrounds = {
	success: 'linear-gradient(to right, #00b09b, #96c93d)',
	error: 'linear-gradient(to right, #c0392b, #e05a47)',
	info: 'linear-gradient(to right, #334155, #475569)',
	achievement: 'linear-gradient(to right, #6d28d9, #db2777)',
};

export function toast(text, type = 'success') {
	Toastify({
		text,
		duration: type === 'achievement' ? 4500 : 3000,
		gravity: type === 'achievement' ? 'bottom' : 'top',
		position: type === 'achievement' ? 'right' : 'center',
		style: { background: backgrounds[type] },
	}).showToast();
}
