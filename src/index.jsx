/* @refresh reload */
import "solid-devtools"
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import './index.css';
import App from './App';
import Blob from './components/Blob';




window.onunload = function () { window.scrollTo(0, 0) };

const root = document.getElementById('root');


if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}


render(() => (
  <>
    <Router >
      <App />
    </Router>
    <Blob />
  </>
),
  root
);
