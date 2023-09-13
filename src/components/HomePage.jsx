import { createSignal, createEffect, onCleanup, lazy } from "solid-js"
import { A } from "@solidjs/router"
import "../css/Homepage.css"
import Header from "./Header"
import About from "./About"
import Socials from "./Socials"
import Projects from "./Projects"


function HomePage() {

  const [rightDiv, setRightDiv] = createSignal();

  createEffect(() => {
    document.title = "Alfred Shaheen"
  })

  createEffect(() => {
    const handleScroll = e => {
      const rightElement = rightDiv();
      if (rightElement) {
        rightElement.scrollTop += e.deltaY;
      }
    };

    window.addEventListener('wheel', handleScroll);

    onCleanup(() => {
      window.removeEventListener("wheel", handleScroll)
    })
  })
  return (
    <>
      <div id="homepage">
        <div id="left" >
          <Header />
          <A
            id="hidden"
            href="/memory-game"
          >CLICK ME!!!</A>
          <Socials />
        </div>
        <div id="right" ref={setRightDiv}>
          <About />
          <Projects />
          <A
            id="hidden"
            href="/tictactoe"
          >TicTacToe</A>
        </div>
      </div>
    </>

  )
}

export default HomePage