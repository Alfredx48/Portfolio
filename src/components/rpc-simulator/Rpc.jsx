import { onCleanup, createEffect, createSignal } from "solid-js";
import Toastify from 'toastify-js'
import "toastify-js/src/toastify.css"
import "./rpc.css";
import FoundMessageContainer from "../FoundMessageContainer"


function Rpc() {
    // Adjust the getBoundWidth() and BOUND_HEIGHT based on the screen width
    const getBoundWidth = () => window.innerWidth <= 1024 ? 400 : 800;
    const getBoundHeight = () => window.innerWidth <= 1024 ? 500 : 600;

    const RPC_AMOUNT = 10;

    const [numberOfRPC, setNumberOfRPC] = createSignal(RPC_AMOUNT);
    const [multiplier, setMultiplier] = createSignal(1);

    function createEntity(type) {
        return {
            type,
            x: Math.random() * (getBoundWidth() - 60),
            y: Math.random() * (getBoundHeight() - 60),
            baseVX: 0.5,
            baseVY: 0.5,
            vx: 0.5,
            vy: 0.5
        };
    }

    const createRPC = () => {
        const initialEntities = [];
        for (let i = 0; i < numberOfRPC(); i++) {
            initialEntities.push(createEntity('rock'));
            initialEntities.push(createEntity('paper'));
            initialEntities.push(createEntity('scissors'));
        }
        return initialEntities;
    }



    const [RPC, setRPC] = createSignal(createRPC());

    const [disabled, setDisabled] = createSignal(true);
    const [simEnded, setSimEnded] = createSignal(false);
    const [winners, setWinners] = createSignal({
        rock: 0,
        paper: 0,
        scissors: 0
    });


    function haveCollided(e1, e2) {
        const dx = e1.x - e2.x;
        const dy = e1.y - e2.y;
        const effectiveRadius = 30;  // Adjust this based on your CSS visual size
        return (dx * dx + dy * dy) <= (effectiveRadius * effectiveRadius);
    }

    let frameId;

    function resolveCollision(type1, type2) {
        if (type1 === "rock" && type2 === "scissors") return type1;
        if (type1 === "scissors" && type2 === "paper") return type1;
        if (type1 === "paper" && type2 === "rock") return type1;
        return type2; // In all other cases including ties, return type2
    }


    const updateRPC = () => {
        const updatedRPC = RPC().map(rpc => {
            let newVX = rpc.vx;
            let newVY = rpc.vy;

            // Boundary Collision
            if (rpc.x < 0 || rpc.x >= getBoundWidth() - 30) {
                newVX = -rpc.vx;
                rpc.x = rpc.x < 0 ? 0 : getBoundWidth() - 30;  // Adjust the x position inside boundary
            }
            if (rpc.y < 0 || rpc.y >= getBoundHeight() - 30) {
                newVY = -rpc.vy;
                rpc.y = rpc.y < 0 ? 0 : getBoundHeight() - 30;  // Adjust the y position inside boundary
            }


            const scaledVX = newVX * multiplier();
            const scaledVY = newVY * multiplier();

            return {
                ...rpc,
                vx: newVX,  // keep the original vx unchanged
                vy: newVY,  // keep the original vy unchanged
                x: rpc.x + scaledVX,
                y: rpc.y + scaledVY
            };


        });


        for (let i = 0; i < updatedRPC.length; i++) {
            for (let j = i + 1; j < updatedRPC.length; j++) {
                if (updatedRPC[i].type === updatedRPC[j].type) continue;
                if (haveCollided(updatedRPC[i], updatedRPC[j])) {
                    // Calculate displacement needed to separate the entities
                    const dx = updatedRPC[j].x - updatedRPC[i].x;
                    const dy = updatedRPC[j].y - updatedRPC[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const overlap = 60 - distance;

                    // Normalize the displacement vector
                    const nx = dx / distance;
                    const ny = dy / distance;
                    // Push away entities by a fraction of the overlap to ensure they are no longer colliding but not pushed too far either
                    const pushFactor = 0.1;  // Can be adjusted
                    updatedRPC[i].x -= overlap * pushFactor * nx;
                    updatedRPC[i].y -= overlap * pushFactor * ny;
                    updatedRPC[j].x += overlap * pushFactor * nx;
                    updatedRPC[j].y += overlap * pushFactor * ny;


                    // Reflect velocities based on the normal
                    const dotI = updatedRPC[i].vx * nx + updatedRPC[i].vy * ny;
                    const dotJ = updatedRPC[j].vx * nx + updatedRPC[j].vy * ny;

                    updatedRPC[i].vx -= 2 * dotI * nx;
                    updatedRPC[i].vy -= 2 * dotI * ny;
                    updatedRPC[j].vx -= 2 * dotJ * nx;
                    updatedRPC[j].vy -= 2 * dotJ * ny;

                    const winnerType = resolveCollision(updatedRPC[i].type, updatedRPC[j].type);
                    updatedRPC[i].type = winnerType;
                    updatedRPC[j].type = winnerType;
                }
            }
        }

        setRPC(updatedRPC);
        frameId = requestAnimationFrame(updateRPC); // Continue the update loop
    };


    const startSim = () => {
        if (simEnded()) return;
        setSimEnded(false);
        cancelAnimationFrame(frameId);  // Cancel any previous animation frame requests
        frameId = requestAnimationFrame(updateRPC);
        setDisabled(false);
    };

    const temporaryStopSim = () => {
        cancelAnimationFrame(frameId);
        setDisabled(false);
    };



    onCleanup(() => {
        cancelAnimationFrame(frameId);
    });

    const resetGame = () => {
        setRPC(createRPC());
        setDisabled(true);
        setSimEnded(false);
        setNumberOfRPC(RPC_AMOUNT);
        setMultiplier(1);
        cancelAnimationFrame(frameId); // Stop the update loop
    };

    const increaseSpeedHandler = () => setMultiplier(multiplier() * 1.5);
    const decreaseSpeedHandler = () => setMultiplier(multiplier() / 1.5);
    const resetSppedHandler = () => setMultiplier(1);

    //Check Winner
    createEffect(() => {
        if (simEnded() || disabled()) return;

        let rockCount = 0, paperCount = 0, scissorsCount = 0;
        RPC().forEach(rpc => {
            if (rpc.type === 'rock') rockCount++;
            else if (rpc.type === 'paper') paperCount++;
            else if (rpc.type === 'scissors') scissorsCount++;
        });

        if (rockCount === 0 && paperCount === 0 && scissorsCount > 0) {
            Toastify({

                text: "Scissors Wins",
                gravity: "top",
                position: "center",
                style: {
                    background: "linear-gradient(to right, #00b09b, #96c93d)",
                },
                duration: 3000

            }).showToast();
            setWinners(prev => ({ ...prev, scissors: prev.scissors + 1 }));
            setSimEnded(true);
            setDisabled(true);
        } else if (rockCount === 0 && scissorsCount === 0 && paperCount > 0) {
            Toastify({

                text: "Paper Wins",
                gravity: "top",
                position: "center",
                style: {
                    background: "linear-gradient(to right, #00b09b, #96c93d)",
                },
                duration: 3000

            }).showToast();
            setWinners(prev => ({ ...prev, paper: prev.paper + 1 }));
            setSimEnded(true);
            setDisabled(true);
        } else if (paperCount === 0 && scissorsCount === 0 && rockCount > 0) {
            Toastify({

                text: "Rock Wins",
                gravity: "top",
                position: "center",
                style: {
                    background: "linear-gradient(to right, #00b09b, #96c93d)",
                },
                duration: 3000

            }).showToast();
            setWinners(prev => ({ ...prev, rock: prev.rock + 1 }));
            setSimEnded(true);
            setDisabled(true);
        }
    });


    createEffect(() => {
        setRPC(createRPC());
    });

    const noRPCOver = (e) => {
        if (simEnded()) return;
        const val = parseInt(e.target.value, 10);
        if (val > 100) {
            Toastify({
                text: "Max number of entities is 100",
                duration: 3000,
                gravity: "top",
                position: "center",
                style: {
                    background: "linear-gradient(to right, #00b09b, #96c93d)",
                },
            }).showToast();
            setNumberOfRPC(100);
        } else if (val < 1) {
            setNumberOfRPC(1);
        } else {
            setNumberOfRPC(val);
        }
    };

    return (
        <>
            <FoundMessageContainer />
            <div class="rpc-sim">
                <div class="stats">
                    <p>Rock: {winners().rock} Paper: {winners().paper} Scissors: {winners().scissors} </p>
                </div>
                <div class="buttons">
                    <button onClick={startSim}> Start </button>
                    <button onClick={temporaryStopSim}> Stop </button>
                    <button onClick={resetGame}>Reset</button >
                    <button onClick={resetSppedHandler}>Reset Speed</button>
                    <button onClick={increaseSpeedHandler}>Increase Speed</button>
                    <button onClick={decreaseSpeedHandler}>Decrease Speed</button>
                    <label>Count per Type:{" "}
                        <input
                            type="number"
                            value={numberOfRPC()}
                            min="1"
                            max="100"
                            onInput={(e) => noRPCOver(e)}

                        />
                    </label>
                </div>
                <div class="border">
                    {RPC().map(rpc => (
                        <div
                            class="rpc"
                            style={{
                                left: `${rpc.x}px`,
                                top: `${rpc.y}px`
                            }}
                        >{rpc.type === 'rock' ? '🪨' : rpc.type === 'paper' ? '🧻' : '✂️'}</div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default Rpc;
