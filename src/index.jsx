/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import './index.css';
import App from './App';
import HomePage from './components/home/HomePage';
import NotFound from './components/NotFound';

const Contact = lazy(() => import('./components/contact/Contact'));
const TicTacToe = lazy(() => import('./components/tictactoe/TicTacToe'));
const MemoryGame = lazy(() => import('./components/memory-game/MemoryGame'));
const Rpc = lazy(() => import('./components/rpc-simulator/Rpc'));
const UltimateTicTacToe = lazy(() => import('./components/tictactoe/ultimate/UltimateTicTacToe'));
const OnlineTicTacToe = lazy(() => import('./components/tictactoe/online/OnlineTicTacToe'));
const NeonRicochet = lazy(() => import('./components/neon-ricochet/NeonRicochet'));
const GamesHub = lazy(() => import('./components/games/GamesHub'));

render(
	() => (
		<Router root={App}>
			<Route path="/" component={HomePage} />
			<Route path="/contact" component={Contact} />
			<Route path="/tictactoe" component={TicTacToe} />
			<Route path="/tictactoe/ultimate" component={UltimateTicTacToe} />
			<Route path="/tictactoe/online" component={OnlineTicTacToe} />
			<Route path="/neon-ricochet" component={NeonRicochet} />
			<Route path="/games" component={GamesHub} />
			<Route path="/memory-game" component={MemoryGame} />
			<Route path="/rpc-simulator" component={Rpc} />
			<Route path="*" component={NotFound} />
		</Router>
	),
	document.getElementById('root'),
);
