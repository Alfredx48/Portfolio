# Alfred Shaheen: Portfolio

My personal site: who I am, the projects I've built, and a few games I made along the way. Built with [SolidJS](https://solidjs.com) and [Vite](https://vite.dev).

## Hidden games

On desktop, a glowing blob follows your cursor. Move it around the empty space in the left column and it lights up links to three hidden games. On phones your finger is the flashlight: the blob appears under it while you touch or scroll, so the links glow if your thumb passes over the empty strip below "Get in Touch". Opening one that way shows a "you found it" message. The games are also listed openly in the **Playground** section for anyone who'd rather not hunt.

- **RPC Simulator** (`/rpc-simulator`): rocks, papers and scissors bounce around a canvas, and whatever one beats becomes its type, until only one type is left. Bet on the winner to build a streak, click the board to drop in reinforcements (dropping mid-round voids your bet), and watch a live population chart with hover tooltips. The physics (elastic collisions, overlap resolution, wall bounces) is in [`simulation.js`](src/components/rpc-simulator/simulation.js), separate from the UI so it can be unit-tested.
- **Memory Game** (`/memory-game`): three difficulties, a timer, match combos, star ratings and saved best scores.
- **TicTacToe** (`/tictactoe`): play a friend or an AI on Easy, Medium or Impossible, as X or O. Impossible is minimax with alpha-beta pruning; its test plays out every possible game against it and checks it never loses.

## Other things to find

- **Command palette:** <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> jumps to any section, game or link.
- **Achievements:** ten of them, from finding the hidden links to holding the Impossible AI to a draw. A trophy counter appears once you earn the first one. Progress is saved in your browser.
- **↑ ↑ ↓ ↓ ← → ← → B A**

## Running it

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # Vitest in watch mode
npm run build     # production build in dist/
npm run preview   # serve the build locally
```

## Project layout

```
src/
  index.jsx                 Router and routes
  App.jsx                   Layout shared by all pages, keyboard shortcuts
  state/                    Achievements and app-wide UI state (palette, trophies, party mode)
  components/
    home/                   Home page: intro column, about, projects, playground, blob
    contact/                Contact form (EmailJS)
    rpc-simulator/          Canvas simulation, population chart, pure physics module
    memory-game/
    tictactoe/              Game UI and logic.js (win detection, minimax AI)
    ui/                     Shared controls
    CommandPalette.jsx, Trophies.jsx, FoundMessage.jsx
  data/                     Project and playground content
  utils/                    Toasts, confetti, safe localStorage
public/_redirects           Netlify SPA fallback
```

To add a project, add an entry to [`src/data/projectData.js`](src/data/projectData.js). `source` is optional.

## Deployment

The site is static and deployed on Netlify. `public/_redirects` sends every path to `index.html` so client-side routes work on refresh.
