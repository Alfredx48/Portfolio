import { lazy, createEffect  } from 'solid-js';
import "./App.css"
import HomePage from './components/HomePage';
// const Logo = lazy(() => import("./components/Logo"))



function App() {

  return (
    <div id='app'>
      {/* <Logo /> */}
      <HomePage />
    </div>

  );
}

export default App;
