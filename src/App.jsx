import { Route, Routes, A } from "@solidjs/router";
import { lazy, onCleanup, createEffect } from 'solid-js';
import TicTacToe from './components/TicTacToe';
import "./App.css"
import HomePage from './components/HomePage';
import MemoryGame from "./components/memory-game/components/MemoryGame";
const Contact = lazy(() => import("./components/Contact"))
const Logo = lazy(() => import("./components/Logo"))
import "solid-devtools"





function App() {


  createEffect(() => {
    const handleRouteChange = () => {
      gtag('event', 'page_view', { page_path: window.location.pathname });
    };

    window.addEventListener("popstate", handleRouteChange);

    onCleanup(() => {
      window.removeEventListener("popstate", handleRouteChange);
    });
  });
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
        <Route path="/rpc-simulator" component={lazy(() => import("./rpc-simulator/Rpc.jsx"))} />
        <Route path="*" element={<h1>Not Found</h1>} />
      </Routes>
    </>
  );
}

export default App;
