import { createSignal } from 'solid-js';
import "./tictactoe.css"
import FoundMessageContainer from '../FoundMessageContainer';

function TicTacToe() {
    const [cells, setCells] = createSignal(Array(9).fill(''));
    const [turn, setTurn] = createSignal('X');
    const [winner, setWinner] = createSignal(null);
    const [clicked, setClicked] = createSignal(0);
    const [showWinner, setShowWinner] = createSignal(false);

    const checkForWinner = (squares) => {
        const winningCombinations = [
            [0, 1, 2], // across
            [3, 4, 5], // across
            [6, 7, 8], // across
            [0, 3, 6], // down
            [1, 4, 7], // down
            [2, 5, 8], // down
            [0, 4, 8], // diagonal
            [2, 4, 6], // diagonal
        ];
    
        for (let pattern of winningCombinations) {
            const [a, b, c] = pattern;
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                setWinner(squares[a]);
                setShowWinner(true);
                return;
            }
        }
    
        // Check for a draw only if all cells have been clicked and no winner was found
        if (!squares.includes('') && !winner()) {
            setWinner('Nobody'); // Setting the winner to 'Nobody' in case of a draw
            setShowWinner(true);
        }
    };
    

    const handleClick = (num) => {
        if (winner()) return;

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
            <FoundMessageContainer />
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
