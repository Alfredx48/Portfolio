/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';
import { Router, Route, Routes } from "@solidjs/router";
import { lazy } from 'solid-js';
import Blob from './components/Blob';
import TicTacToe from './components/TicTacToe';

document.addEventListener("DOMContentLoaded", function() {
  window.scrollTo(0, 0);
});

window.onunload = function () { window.scrollTo(0, 0); }

const root = document.getElementById('root');
const HomePage = lazy(() => import("./components/HomePage"))
const Contact = lazy(() => import("./components/Contact"))

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}


render(() => (
  <>
    <Blob />
    <Router >
      <Routes>
        <Route path="/" component={App} />
        {/* <Route path="/home" component={HomePage} /> */}
        <Route path="/contact" component={Contact} />
        <Route path="/tictactoe" component={TicTacToe} />
      </Routes>
    </Router>
  </>
),
  root
);
