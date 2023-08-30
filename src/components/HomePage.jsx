import { lazy } from "solid-js"
import { A } from "@solidjs/router"
import "../css/Homepage.css"
import Header from "./Header"
import About from "./About"
import Socials from "./Socials"
import Projects from "./Projects"
const Logo = lazy(() => import("./Logo"))

function HomePage() {
  return (
    <>
      <Logo />
      <div id="homepage">
        <div id="left" >
        <Header />
        <Socials />
        </div>
        <div id="right">
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