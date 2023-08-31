import { createSignal, createEffect, onCleanup } from "solid-js"
import { A } from "@solidjs/router"
import "../css/Homepage.css"
import Header from "./Header"
import About from "./About"
import Socials from "./Socials"
import Projects from "./Projects"

function HomePage() {

  const [rightDiv, setRightDiv] = createSignal();

  createEffect(() => {
    const handleScroll = e => {
      e.preventDefault();
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
          <Socials />
        </div>
        <div id="right" ref={setRightDiv}>
          <About />
          <Projects />
        </div>
      </div>

      {/* <A
          id="hidden"
          href="/tictactoe"
          activeClass="underlined"
        >TicTacToe</A> */}
    </>
  )
}

export default HomePage