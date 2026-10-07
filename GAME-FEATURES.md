# New game features

These additions belong to `/home/alfred/projects/Portfolio`, the original portfolio. Start with `npm run dev` and open http://localhost:3000/games.

## TicTacToe: match series

Choose Free play, First to 3 wins, or First to 5 wins. Match progress is separate from saved totals. Draws do not count toward the target. Next round keeps the series going; New match clears it after a winner is decided. Changing opponent, difficulty, mark, board size, or rules starts a new series. Hints and undo are disabled during a match. Existing free-play behavior remains available.

## Memory: pause and resume

Classic games have Pause/Resume and the P shortcut while focus is within the game. Pausing hides all cards, freezes elapsed time, and suspends a pending mismatch flip. Resume restores the cards and the remaining flip delay. Switching tabs pauses Classic games automatically. Daily and Time Attack retain their running clocks and existing challenge rules.

## RPC Simulator: single-step controls

Step +0.1s advances a paused round by one tenth of a simulated second, independently of playback speed. A simulated-time readout shows progress. Stepping begins the round and locks bets and chart predictions just like Start. Wins use the existing scoring and achievement behavior. Step is disabled during playback, after a round ends, and during batch simulations.

## Ultimate TicTacToe: destination preview

Hover or focus a legal square to highlight the board your opponent would have to play next. If that board is closed, all remaining open boards are highlighted. The preview considers the move itself, including a newly claimed board or a game-ending move. It explains the destination in text as well as visually; no move is committed until you click or activate the square.

## Online TicTacToe: move log

Expand Move log during a connected game to see each move's mark, player, row and column. The latest entry and board square are highlighted. Rematches begin with an empty log, and a rejoining player's existing game state supplies the same history. This feature uses the moves already shared by the game and adds no network messages.


# Creative expansion

## Neon Ricochet — new arcade game

Open `/neon-ricochet`, or choose Neon Ricochet on the homepage, Games hub, or command palette. Steer a paddle, chain brick hits for up to an eight-times multiplier, and clear five sectors. Armored bricks take two hits. Every sixth destroyed brick drops a power-up: a wide paddle, slow ball, or one-use shield. Each sector awards bonus points and a life. Records and three achievements persist in this browser.

Pointer and touch dragging steer the paddle. Focus the canvas and use arrow keys or A/D; Space or P launches/pauses/resumes. The on-screen buttons support touch and keyboard activation. Scrolling away from a live game, changing tabs, or leaving the browser pauses it. Reduced motion removes particles and glow.

## Orbit TicTacToe

Choose Orbit in the Rules control under More options. The perimeter advances one cell clockwise after every two placements; inner cells remain fixed. A winning placement ends the game before a shift. Otherwise wins are checked after shifting; simultaneous X/O wins produce a draw. Replay and undo preserve the rotation events. Orbit has separate score keys, does not award classic AI achievements, and uses a heuristic Hard AI rather than the classic Impossible guarantee. Classic hints are unavailable in Orbit.

## Drift Memory

Choose Drift in the Mode control. Every third mismatch shuffles all unmatched cards after their reveal delay. Matched pairs remain in place. The status line tells you how close the next drift is. Drift supports the existing peek and pause controls and uses its own best-score keys, so it does not overwrite Classic records or the daily challenge.

## RPC wormholes

Enable portals to link two areas of the arena. A piece entering a portal emerges from the other with its velocity intact; a cooldown prevents it from immediately bouncing back. The interface counts jumps. Portal rounds still count type wins, but bets and chart predictions are experimental and do not earn prediction streaks or Oracle achievements. Portals apply to the interactive arena, not batch simulations.

## Ultimate wildcard

Each player gets one wildcard per round. When forced into a specific board, arm Wildcard to choose any open board for that move. Cancel before playing to keep it. The chosen cell still determines the opponent's next board normally. The AI may spend its wildcard to claim a board outside its forced destination. Replay-derived state tracks the remaining wildcard for each side.

## Online table talk

Send Hello, Nice move, You got me, or Good game using the quick-reaction buttons. The last three reactions appear as bubbles. Sends and receives have a short cooldown, and reactions are tied to the current round. Both clients advertise reaction support; clients without it can still play, with reactions unavailable. Text is selected from fixed phrases rather than free-form chat. No external messages were sent while developing this feature.
