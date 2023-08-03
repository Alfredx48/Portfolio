import { lazy } from "solid-js"
import { A } from "@solidjs/router"
import "../css/Homepage.css"
import Header from "./Header"
import About from "./About"
import Socials from "./Socials"
const Logo = lazy(() => import("./Logo"))

function HomePage() {
  return (
    <>
      <Logo />
      <div id="homepage">
        <Header />
        <About />
      <A
        id="hidden"
        href="/tictactoe"
        activeClass="underlined"
      >TicTacToe</A>
      </div>
      <Socials />
      
      
    </>
  )
}

export default HomePage