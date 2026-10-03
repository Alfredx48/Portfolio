import cardBack from '../../assets/memory-game-images/card-back.webp';

function Card(props) {
	return (
		<button
			class="mg-card"
			classList={{ 'face-up': props.faceUp, matched: props.matched }}
			onClick={() => props.onFlip()}
			aria-label={props.faceUp ? props.name : 'Hidden card'}
		>
			<img class="mg-face" src={props.image} alt="" draggable="false" />
			<img class="mg-back" src={cardBack} alt="" draggable="false" />
		</button>
	);
}

export default Card;
