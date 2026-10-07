import { EMOJI, LABEL } from './simulation';

// Seconds as m:ss
export function formatDuration(seconds) {
	const whole = Math.round(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// What gets shared after a round: { winner, seconds, rules, custom, called, score }, where `score` is the
// prediction score out of 100 or null. Extras are separated with dots, so nothing needs nesting in brackets.
export function shareText({ winner, seconds, rules, custom = false, called = false, score = null }) {
	const extras = [];
	if (rules.id !== 'classic') extras.push(`${rules.name} rules`);
	if (custom) extras.push('custom rules');
	if (called) extras.push('I called it!');
	if (score !== null) extras.push(`🔮 ${score}/100 prediction score`);
	const tail = extras.map((extra) => ` · ${extra}`).join('');
	return `${EMOJI[winner]} ${LABEL[winner]} won the RPC Simulator in ${formatDuration(seconds)}${tail}`;
}
