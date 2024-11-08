import "./tictactoe.css"
import FoundMessageContainer from '../FoundMessageContainer';

import { createSignal, createEffect } from "solid-js";

const TicTacToe = () => {
    // SolidJS signals must be called as functions: turn(), cells()
    const [turn, setTurn] = createSignal("X");
    const [winner, setWinner] = createSignal(null);
    const [cells, setCells] = createSignal(Array(9).fill(""));
    const [showWinner, setShowWinner] = createSignal(false);

    const Cell = (props) => {
        return (
            <td
                onClick={() => handleClick(props.num)}
                class="cell"
            >
                {cells()[props.num]}
            </td>
        );
    };

    const Table = () => {
        return (
            <table class="game-board">
                <tbody>
                    <tr>
                        <Cell num={0} />
                        <Cell num={1} />
                        <Cell num={2} />
                    </tr>
                    <tr>
                        <Cell num={3} />
                        <Cell num={4} />
                        <Cell num={5} />
                    </tr>
                    <tr>
                        <Cell num={6} />
                        <Cell num={7} />
                        <Cell num={8} />
                    </tr>
                </tbody>
            </table>
        );
    };

    const checkForWinner = (squares) => {
        // Define all possible winning combinations on a tic-tac-toe board
        // Each sub-array represents indices that form a line:
        // [0, 1, 2] → First row
        // [3, 4, 5] → Second row
        // [6, 7, 8] → Third row
        // [0, 3, 6] → First column
        // [1, 4, 7] → Second column
        // [2, 5, 8] → Third column
        // [0, 4, 8] → Diagonal from top-left to bottom-right
        // [2, 4, 6] → Diagonal from top-right to bottom-left
        const winningCombos = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        // Check each winning combination
        for (let pattern of winningCombos) {
            const [a, b, c] = pattern;  // Get three positions that would make a win

            // Check if:
            // 1. First position has a value (not empty)
            // 2. All three positions have the same value (all X's or all O's)
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                setWinner(squares[a]);  // Set winner to X or O
                setShowWinner(true);    // Show the winner announcement
                return;
            }
        }

        // If no winner is found and no empty cells remain (no "")
        // then the game is a draw
        if (!squares.includes("") && !winner()) {
            setWinner("Draw");
            setShowWinner(true);
        }
    };

    const handleClick = (num) => {
        // Prevent moves if cell is taken or game is over
        if (cells()[num] || showWinner()) return;

        // Update the game board with the current player's move
        let squares = [...cells()];
        squares[num] = turn();

        setCells(squares);
        setTurn(turn() === "X" ? "O" : "X");
        // Check if this move resulted in a win
        checkForWinner(squares);
    };

    const handleRestart = () => {
        setWinner(null);
        setCells(Array(9).fill(""));
        setShowWinner(false);
        setTurn("X");
    };

    return (
        <>
            <FoundMessageContainer />
            <div class="game-container">
                <div class="header animate-in">
                    <h1 class="title">TicTacToe</h1>
                    <h2 class="turn-indicator">
                        Turn: <span class="current-turn">{turn()}</span>
                    </h2>
                </div>

                <div class="board-container animate-in">
                    <Table />
                </div>

                {showWinner() && (
                    <div class="winner-container animate-in">
                        <p class="winner-text">
                            {winner() === "Draw" ? "It's a draw!" : `${winner()} is the winner!`}
                        </p>
                        <button
                            onClick={handleRestart}
                            class="restart-button"
                        >
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default TicTacToe;