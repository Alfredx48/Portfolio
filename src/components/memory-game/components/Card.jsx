import cardBack from "../../../assets/memory-game-images/computer from the 90s.png"
import { createMemo } from "solid-js";

function Card({ image, onClick, card, pickOne, pickTwo, matched}) {
    const isSelected = createMemo(() => {
        return card === pickOne() || card === pickTwo() || matched;
    });
    
    return (
        <div class="card">
            <div class={isSelected() ? "selected" : ""}>
                <img alt="card-face" src={image} class="card-face" />
                <img
                    alt="card-back"
                    class="card-back"
                    src={cardBack}
                    onClick={onClick}
                />
            </div>
        </div>
    );
};

export default Card