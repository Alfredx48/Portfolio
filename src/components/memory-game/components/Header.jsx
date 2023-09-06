import { createEffect } from "solid-js";
import FoundMessageContainer from "../../FoundMessageContainer";


function Header({
    handleNewGame,
    wins,
    timeLeft,
}) {

    createEffect(() => {
        document.title = `${wins()} ${wins() !== 1 ? "wins" : "win"}`;
    })



    return (
        <div class="header-container">
            <FoundMessageContainer />
            <header class="header">
                <h4>
                    {wins()} {wins() !== 1 ? "Wins" : "Win"}
                </h4>
                {/* <h4>
                    {timeLeft} Second{timeLeft !== 1 ? "s" : ""}
                </h4> */}
                <h3> Memory Game</h3>
                <button onClick={handleNewGame}> Reset Game</button>
            </header>
        </div>
    );
}
export default Header;