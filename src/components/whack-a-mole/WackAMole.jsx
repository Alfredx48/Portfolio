import "./WackAMole.css"
import { createSignal } from "solid-js"

import hole from "../../assets/hole.png"
import mole from "../../assets/mole.png"

function WackAMole() {
    const [moles, setMoles] = createSignal(new Array(9).fill(false))
    console.log(moles())


    const displayMoles =
        moles().map(isMole => (
            <img src={isMole ? mole : hole} alt={isMole ? "mole" : "hole"} />
        ))



    return (
        <div class="grid">
            {displayMoles}
        </div>
    )
}

export default WackAMole

