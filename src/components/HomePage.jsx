import { createSignal, createEffect, onCleanup, lazy } from "solid-js"
import { A } from "@solidjs/router"
import "../css/Homepage.css"
import Header from "./Header"
import About from "./About"
import Socials from "./Socials"
import Projects from "./Projects"
import Blob from "./Blob"


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

  const currentYear = () => {
    const year = new Date().getFullYear();
    return year;
  }

  const copyRight = `COPYRIGHT © ${currentYear()} ALFRED SHAHEEN`

  return (
    <>
      <div id="homepage">
        <div id="left" >
          <Header />
          <A
            id="hidden"
            href="/memory-game"
            >Memory Game</A>
          <A
            id="hidden"
            href="/rpc-simulator"
            >RPC Simulator</A>
          {/* <A
            id="hidden"
            href="/whack-a-mole"
          >Whack-A-Mole</A> */}
          <Socials />
        </div>
        <div id="right" ref={setRightDiv}>
          <About />
          <Projects />
          <footer id="copywright"> {copyRight}</footer>
          <A
            id="hidden"
            href="/tictactoe"
            >TicTacToe</A>
        </div>
      </div>
      <Blob />
    </>

  )
}

export default HomePage