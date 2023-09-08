import cssImage from '../../../assets/memory-game-images/css.png';
import dartImage from '../../../assets/memory-game-images/dart.png';
import firebaseImage from '../../../assets/memory-game-images/firebase.png';
import fireshipImage from '../../../assets/memory-game-images/fireship.png';
import flutterImage from '../../../assets/memory-game-images/flutter.png';
import goImage from '../../../assets/memory-game-images/go.png';
import html5Image from '../../../assets/memory-game-images/html5.png';
import jqueryImage from '../../../assets/memory-game-images/jquery.png';
import jsImage from '../../../assets/memory-game-images/js.png';
import jsxImage from '../../../assets/memory-game-images/jsx.png';
import nextImage from '../../../assets/memory-game-images/next.png';
import nodeImage from '../../../assets/memory-game-images/node.png';
import pythonImage from '../../../assets/memory-game-images/python.png';
import reactImage from '../../../assets/memory-game-images/react.png';
import rustImage from '../../../assets/memory-game-images/rust.png';
import sqlImage from '../../../assets/memory-game-images/sql.png';
import stackImage from '../../../assets/memory-game-images/stack.png';
import tsImage from '../../../assets/memory-game-images/ts.png';

const shuffle = () => {
	const assets = [
		{ image: cssImage, matched: false, id: 1 },
		{ image: dartImage, matched: false, id: 2 },
		{ image: firebaseImage, matched: false, id: 3 },
		{ image: flutterImage, matched: false, id: 4 },
		{ image: goImage, matched: false, id: 5 },
		{ image: html5Image, matched: false, id: 6 },
		{ image: jqueryImage, matched: false, id: 7 },
		{ image: jsImage, matched: false, id: 8 },
		{ image: jsxImage, matched: false, id: 9 },
		{ image: nextImage, matched: false, id: 10 },
		{ image: nodeImage, matched: false, id: 11 },
		{ image: pythonImage, matched: false, id: 12 },
		{ image: reactImage, matched: false, id: 13 },
		{ image: rustImage, matched: false, id: 14 },
		{ image: sqlImage, matched: false, id: 15 },
		// { image: stackImage , matched: false, id:  16},
		// { image: tsImage, matched: false, id:  17}
		// { image: fireshipImage , matched: false, id:  18},
	];

	const shuffledAssets = [];
	for (let i = 0; i < assets.length; i++) {
		shuffledAssets.push(assets[i], { ...assets[i], id: i + assets.length });
	}

	for (let i = shuffledAssets.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffledAssets[i], shuffledAssets[j]] = [
			shuffledAssets[j],
			shuffledAssets[i],
		];
	}

	return shuffledAssets;
};

export default shuffle;
