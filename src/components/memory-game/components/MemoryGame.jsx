import { createSignal, createEffect, For } from "solid-js";
import Card from "./Card";
import Header from "./Header";
import shuffle from "../utilities/shuffle";
import "../styles/MemoryGame.css"
import useAppBadge from "../hooks/useAppBadge";
function MemoryGame() {

    const [wins, setWins] = createSignal(0);
    const [cards, setCards] = createSignal(shuffle());
    const [pickOne, setPickOne] = createSignal(null);
    const [pickTwo, setPickTwo] = createSignal(null);
    const [disabled, setDisabled] = createSignal(false);
    const [timeLeft, setTimeLeft] = createSignal(0);
    const [winTime, setWinTime] = createSignal(0);
    const [setBadge, clearBadge] = useAppBadge()


    const handleClick = (card) => {
        if (!disabled()) {
            pickOne() ? setPickTwo(card) : setPickOne(card);
        }
    };

    const handleTurn = () => {
        setPickOne(null);
        setPickTwo(null);
        setDisabled(false);
    };

    const handleNewGame = () => {
        setWins(0);
        clearBadge();
        handleTurn();
        setWinTime(0);
        setCards(shuffle)
    };

    createEffect(() => {
        let pickTimer;
        if (pickOne() && pickTwo()) {
            if (pickOne().image === pickTwo().image) {
                setCards((prevCards) => {
                    return prevCards.map((card) => {
                        //  debugger
                        if (card.image === pickOne().image && !card.matched) {
                            return { ...card, matched: true }
                        } else {
                            return card;
                        }
                    });
                });
                handleTurn();
            } else {
                setDisabled(true);

                pickTimer = setTimeout(() => {
                    handleTurn();
                }, 1000);
            }
        }
        return () => {
            clearTimeout(pickTimer);
        };
    })


    createEffect(() => {
        const checkWin = cards().filter((card) => !card.matched);
        if (cards().length && checkWin.length < 1) {
            console.log("You Win");
            setWins((prev) => prev + 1);
            handleTurn();
            setTimeLeft((prev) => prev);
            setCards(shuffle())
            setBadge()
            // alert("You Win")
        }
    })



    //  createEffect(() => {
    //     let timer;
    // 		if (timeLeft <= 0) {
    // 			handleNewGame();
    // 			setGameStarted(false);
    // 			alert("YOU LOST!!!!")
    // 		} else if (timeLeft !== Infinity) {
    // 			timer = setTimeout(() => {
    // 				setTimeLeft(timeLeft - 1);
    // 			}, 1000);
    // 		}

    // 	return () => clearTimeout(timer);
    //  })



    return (
        <>
            <Header
                handleNewGame={handleNewGame}
                wins={wins}
                timeLeft={timeLeft()}
                winTime={winTime()}
            />

            <div class="grid">
                <For each={cards()}>
                    {(card) => (
                        <Card
                            key={card.id}
                            card={card}
                            image={card.image}
                            onClick={() => handleClick(card)}
                            pickOne={pickOne}
                            pickTwo={pickTwo}
                        />
                    )}
                </For>
            </div>
        </>
    );
}
export default MemoryGame;