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

## Neon Ricochet — arcade expedition

Open `/neon-ricochet`, or choose Neon Ricochet on the homepage, Games hub, or command palette.

### Two routes, three ships

Campaign crosses twelve named sectors, including three boss encounters in sectors 4, 8, and 12. Boss Rush starts directly at those three encounters. Its record is separate from Campaign, and starting at a later sector does not award campaign progress achievements.

Choose a ship before starting: Courier is balanced, Bulwark has a wider paddle and extra life with slower balls, and Interceptor trades a life and paddle width for faster Nova charging. Changing the selected ship or route during an active run configures the next run.

### Build a loadout

Campaign offers three upgrade cards after clearing sectors 2, 4, 6, 8, and 10. Boss Rush offers cards after its first two bosses. The game freezes while choosing. Pick one permanent upgrade; its stack count carries through that run, including lost lives. Available upgrades improve paddle width or movement, score gains, pulse charging, power duration, collectible attraction, laser damage, or a starting shield. Stack limits prevent unlimited bonuses.

Armored bricks require multiple hits. Reactor bricks damage their neighbors and can trigger explosive chains. Selected sectors add moving bumpers that redirect the ball. Bosses move across the arena, fire telegraphed shots, and must be defeated alongside their accompanying bricks to clear the sector. A safety shield can absorb an incoming shot; otherwise a paddle hit costs a life. Boss damage remains after losing a life.

### Nova Pulse

Brick and boss hits charge the Nova meter. At full charge, press E or use the Nova button to damage the field and boss, destroy hostile shots, and send a visible shockwave across the arena. The meter resets after use. Pulses cannot fire while paused or choosing upgrades.

### Collectible powers

Every fifth destroyed brick drops a collectible. Eight powers rotate through the run:

| Power | Effect |
| --- | --- |
| Stretch | A wider paddle for 12 seconds. |
| Time Warp | Slows ball movement for 9 seconds. |
| Safety Net | Saves one falling ball or absorbs a hostile shot. |
| Split Signal | Splits play into up to three balls; a life is lost only when all balls fall. |
| Pulse Cannons | Automatically fires brick-breaking bolts for 10 seconds. |
| Fireball | Pierces bricks and burns through armor for 8 seconds. |
| Magnetic Grip | Catches rebounds on the paddle for 10 seconds; release with Launch or Space. |
| Extra Life | Restores one life, up to five. |

Upgrade bonuses can extend timed powers. Timers stop during pauses and upgrade choices; temporary powers reset after losing a life or advancing sectors. Permanent upgrades remain. Consecutive brick hits build a score multiplier up to ×8.

### Controls, presentation, and records

Pointer and touch dragging steer the paddle. Focus the canvas and use arrow keys or A/D. Space launches/releases a held ball or pauses an active rally; P pauses/resumes; E triggers a charged Nova Pulse. Native buttons support touch and keyboard play. Fullscreen expands the cockpit when supported; Escape exits using the browser's standard behavior.

The cockpit includes boss health, charge status, active power timers, and campaign progress. The hangar, route map, and power guide explain choices. Cosmic backdrops, trails, impact effects, moving hazards, and shockwaves follow reduced-motion preferences. The optional original synth soundtrack starts only after choosing Music, follows the shared mute setting, and quiets when paused or outside live play.

Campaign records use the existing `ricochet-best` key; Boss Rush uses `ricochet-bossrush-best`. Best score, progress, and combo persist after completed or abandoned runs, without mixing the two routes. Achievements reward power catches, campaign progress, Nova use, boss victories, and a complete five-upgrade campaign build. No live deployment is made by editing these files.

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
