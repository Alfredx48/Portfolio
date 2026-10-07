import { muted, playSound, toggleMuted } from '../../utils/sound';
import './sound-toggle.css';

// A round speaker button for a game's action row.
function SoundToggle() {
	const click = () => {
		toggleMuted();
		// Confirms that sound works, and only plays when it has just been turned on
		playSound('pop');
	};

	return (
		<button type="button" class="btn btn-ghost sound-toggle" aria-label="Sound" aria-pressed={!muted()} title={muted() ? 'Sound off' : 'Sound on'} onClick={click}>
			<span aria-hidden="true">{muted() ? '🔇' : '🔊'}</span>
		</button>
	);
}

export default SoundToggle;
