import { createSignal } from 'solid-js';
import "../css/tictactoe.css"

function TicTacToe() {
    const [cells, setCells] = createSignal(Array(9).fill(''));
    const [turn, setTurn] = createSignal('X');
    const [winner, setWinner] = createSignal(null);
    const [clicked, setClicked] = createSignal(0);
    const [showWinner, setShowWinner] = createSignal(false);

    const checkForWinner = (squares) => {
        let combos = {
            across: [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
            down: [[0, 3, 6], [1, 4, 7], [2, 5, 8]],
            diagonal: [[0, 4, 8], [2, 4, 6]],
        }

        for (let combo in combos) {
            combos[combo].forEach((pattern) => {
                if (squares[pattern[0]] === "" || squares[pattern[1]] === "" || squares[pattern[2]] === "") {
                } else if (squares[pattern[0]] === squares[pattern[1]] && squares[pattern[1]] === squares[pattern[2]]) {
                    setWinner(squares[pattern[0]]);
                    setShowWinner(true);
                }
                else if (clicked() === 8) {
                      setShowWinner(true);
                  }
                  });
        }
    }

    const handleClick = (num) => {
        if (cells()[num] !== "") {
            alert("already clicked");
            return;
        }

        let squares = [...cells()];
        setClicked(prev => prev + 1);

        if (turn() === 'X') {
            squares[num] = 'X';
            setTurn('O');
        } else {
            squares[num] = 'O';
            setTurn('X');
        }

        setCells(squares);
        checkForWinner(squares);
    }

    const handleRestart = () => {
        setWinner(null);
        setCells(Array(9).fill(''));
        setTurn('X');
        setClicked(0);
        setShowWinner(false);
    }

    return (
        <div class='container'>
            <h1>TicTacToe</h1>
            <h2>Turn: {turn()}</h2>
            <table>
                <tbody>
                    {Array(3).fill().map((_, i) => 
                        <tr>
                            {Array(3).fill().map((_, j) => 
                                <td onClick={() => handleClick(i * 3 + j)}>{cells()[i * 3 + j]}</td>
                            )}
                        </tr>
                    )}
                </tbody>
            </table>
            {showWinner() && (
                <div>
                    <p>{winner() || 'Nobody'} is the winner</p>
                    <button onClick={handleRestart}>Play Again</button>
                </div>
            )}
        </div>
    );
}

export default TicTacToe;
