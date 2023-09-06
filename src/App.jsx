import { Router, Route, Routes, A } from "@solidjs/router";
import { lazy } from 'solid-js';
import TicTacToe from './components/TicTacToe';
import "./App.css"
import HomePage from './components/HomePage';
import MemoryGame from "./components/memory-game/components/MemoryGame";
const Contact = lazy(() => import("./components/Contact"))
const Logo = lazy(() => import("./components/Logo"))




function App() {

  return (
    <>
    <A id="hidden"
    href="/"
    activeClass="underlined"> <Logo /> </A>
        <Routes>
          <Route path="/" component={HomePage} />
          <Route path="/contact" component={Contact} />
          <Route path="/tictactoe" component={TicTacToe} />
          <Route path="/memory-game" component={MemoryGame} />
        </Routes>
    </>
  );
}

export default App;
