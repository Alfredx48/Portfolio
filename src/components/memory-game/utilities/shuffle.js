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
    { image: cssImage },
    { image: dartImage },
    { image: firebaseImage },
    { image: fireshipImage },
    { image: flutterImage },
    { image: goImage },
    { image: html5Image },
    { image: jqueryImage },
    { image: jsImage },
    { image: jsxImage },
    { image: nextImage },
    { image: nodeImage },
    // { image: pythonImage },
    // { image: reactImage },
    // { image: rustImage },
    // { image: sqlImage },
    // { image: stackImage },
    // { image: tsImage }
  ];

  const shuffledAssets = [];
  for (let i = 0; i < assets.length; i++) {
    shuffledAssets.push(assets[i], { ...assets[i], id: i + assets.length });
  }

  for (let i = shuffledAssets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledAssets[i], shuffledAssets[j]] = [shuffledAssets[j], shuffledAssets[i]];
  }

  return shuffledAssets;
};


export default shuffle;