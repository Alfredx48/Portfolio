import { lazy } from "solid-js"
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
      </div>
        <Socials />

    </>
  )
}

export default HomePage