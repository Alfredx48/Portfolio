import { For, Show } from 'solid-js';
import cardBack from '../../assets/memory-game-images/card-back.webp';

const BURST = Array.from({ length: 8 }, (_, i) => i);

function Card(props) {
	return (
		<button
			class="mg-card"
			classList={{ 'face-up': props.faceUp, matched: props.matched, miss: props.miss }}
			onClick={() => props.onFlip()}
			disabled={props.disabled}
			aria-label={props.faceUp ? props.name : 'Hidden card'}
		>
			<span class="mg-inner">
				<img class="mg-face" src={props.image} alt="" draggable="false" />
				<img class="mg-back" src={cardBack} alt="" draggable="false" />
			</span>
			<Show when={props.matched}>
				<span class="mg-burst" aria-hidden="true">
					<For each={BURST}>{(i) => <i style={{ '--angle': `${i * 45 + 22}deg`, '--reach': `${i % 2 ? 2.4 : 1.7}rem` }} />}</For>
				</span>
			</Show>
		</button>
	);
}

export default Card;
