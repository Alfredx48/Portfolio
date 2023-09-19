import { onCleanup, createEffect, createSignal, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import Toastify from 'toastify-js'
import "toastify-js/src/toastify.css"
import "./rpc.css";

const BOUND_WIDTH = 600;
const BOUND_HEIGHT = 600;
const RPC_AMOUNT = 10;

const [numberOfRPC, setNumberOfRPC] = createSignal(RPC_AMOUNT);
const [multiplier, setMultiplier] = createSignal(1);


function createEntity(type) {
    return {
        type,
        x: Math.random() * (BOUND_WIDTH - 40),
        y: Math.random() * (BOUND_HEIGHT - 40),
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



const [RPC, setRPC] = createStore(createRPC());

function Rpc() {
    const [disabled, setDisabled] = createSignal(true);
    const [simEnded, setSimEnded] = createSignal(false);
    const [winners, setWinners] = createSignal([
        { rock: 0 },
        { paper: 0 },
        { scissors: 0 }
    ]);


    function haveCollided(e1, e2) {
        const dx = e1.x - e2.x;
        const dy = e1.y - e2.y;
        return (dx * dx + dy * dy) <= 400; // 20 * 20
    }

    let frameId;

    const updateRPC = () => {
      const updatedRPC = RPC.map(rpc => {
          let newVX = rpc.vx;
          let newVY = rpc.vy;

          // Boundary Collision
          if (rpc.x < 0 || rpc.x >= BOUND_WIDTH - 25) {
              newVX = -rpc.vx;
              rpc.x = rpc.x < 0 ? 0 : BOUND_WIDTH - 25;  // Adjust the x position inside boundary
          }
          if (rpc.y < 0 || rpc.y >= BOUND_HEIGHT - 25) {
              newVY = -rpc.vy;
              rpc.y = rpc.y < 0 ? 0 : BOUND_HEIGHT - 25;  // Adjust the y position inside boundary
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

        function resolveCollision(type1, type2) {
            if (type1 === "rock" && type2 === "scissors") return type1;
            if (type1 === "scissors" && type2 === "paper") return type1;
            if (type1 === "paper" && type2 === "rock") return type1;
            return type2; // In all other cases including ties, return type2
        }

        for (let i = 0; i < updatedRPC.length; i++) {
            for (let j = i + 1; j < updatedRPC.length; j++) {
                if (updatedRPC[i].type === updatedRPC[j].type) continue;
                if (haveCollided(updatedRPC[i], updatedRPC[j])) {
                    // Calculate displacement needed to separate the entities
                    const dx = updatedRPC[j].x - updatedRPC[i].x;
                    const dy = updatedRPC[j].y - updatedRPC[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const overlap = 20 - distance;

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
        setSimEnded(false);
        cancelAnimationFrame(frameId);  // Cancel any previous animation frame requests
        frameId = requestAnimationFrame(updateRPC);
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
        cancelAnimationFrame(frameId); // Stop the update loop
    };

    //Check Winner
    createEffect(() => {
        if (simEnded() || disabled()) return;

        let rockCount = 0, paperCount = 0, scissorsCount = 0;
        RPC.forEach(rpc => {
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
            setWinners({ scissors: winners().scissors + 1 });
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
            setWinners({ paper: winners().paper + 1 });
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
            setWinners({ rock: winners().rock + 1 });
            setSimEnded(true);
            setDisabled(true);
        }
    });

    createEffect(() => {
        setRPC(createRPC());
    });

    const noRPCOver = (e) => {
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
        <div class="rpc-sim">
            <div class="buttons">
                <button onClick={startSim}> Start </button>
                <button onClick={() => {
                    setMultiplier(1)
                    resetGame()
                }}>Reset</button >
                <button onClick={() => setMultiplier(multiplier() * 1.5)}>Increase Speed</button>
                <button onClick={() => setMultiplier(multiplier() / 1.5)}>Decrease Speed</button>
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
                {RPC.map(rpc => (
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
    );
}

export default Rpc;
