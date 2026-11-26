# Sweep Race

A two-player Minesweeper website with invite codes, identical boards, live progress, and rematches. Its compact layout, rounded cards, raised green/blue buttons, and original landscape artwork take inspiration from Daily Holes.

**Start here:** [DEPLOY.md](DEPLOY.md) explains how to put it on GitHub and get a public, free Render URL. The website is not deployed just because these files are on your computer or on GitHub.

## Run on your computer

1. Install the current Node.js LTS from https://nodejs.org if you do not have Node.js 22 or later.
2. Open Terminal in this folder.
3. Run:

   ```sh
   npm start
   ```

4. Open http://localhost:3000 in your browser.

There are **no third-party runtime dependencies**, API keys, databases, or build tools to configure. `npm install` is not required to run locally. On a Mac, you can also double-click `Start-Game.command` after installing Node.js. macOS may ask before allowing a downloaded command file to run; Terminal is an alternative.

To test both players on one computer, use two browser profiles, a normal and private window, or `localhost:3000` for player one and `127.0.0.1:3000` for player two. Two ordinary tabs on the exact same origin share the saved player identity and resume the same player.

## The rules

- Exactly two players per room. Create a room and share its six-character invite code or link.
- Both players tap Ready. A shared three-second countdown starts the race.
- Each player has an independent copy of the **same 9 × 9 board with 12 mines**. Both start with the identical safe area already open.
- Tap to reveal. Use the on-screen Flag button to mark or unmark a tile. Desktop players can also right-click, or focus a tile and press F.
- Numbers count mines in all eight neighboring directions. Tapping a revealed number opens its remaining neighbors if the matching number of flags are placed. Wrong flags can hit a mine.
- **The first player to reveal every safe tile wins immediately.**
- **A mine freezes that player’s safe-tile score.** The surviving player continues until they reveal more safe tiles or also hit a mine. If the survivor is already ahead, they win immediately.
- If both hit mines, the higher safe-tile count wins. An equal count is a draw.
- Flags do not score. Automatically opened safe tiles do score, equally for both players.
- A player can also concede. There is no time limit on an active race.
- A rematch needs both players’ consent, uses a fresh shared board, and retains the match-win count for that room.
- Random boards are not guaranteed to be solvable without guessing.

Moves are processed in server arrival order. This includes the rare case of two nearly simultaneous winning moves.

## iPhone / iOS

The interface uses a responsive board, a viewport that allows zoom, safe-area spacing, 16 px text inputs to avoid Safari’s automatic focus zoom, and an explicit Reveal/Flag toggle. It does not depend on hovering or right-clicking. Share Invite uses the native iOS share sheet on HTTPS, with a copy fallback. Hidden tabs pause background polling; returning to Safari fetches the actual server state. Refreshing reconnects using the saved player token.

On an iPhone after deployment: open the HTTPS URL in Safari. You may optionally use Safari’s Share → Add to Home Screen. No App Store submission is needed. This is an online website, not an offline app.

Phone-sized Chromium layouts were checked during development. Real iOS Safari/WebKit and the native share sheet still need the device checks in [TESTING.md](TESTING.md).

## Project files

```text
server.mjs                 HTTP server, rooms, authentication, static files
game.mjs                   Authoritative Minesweeper and win-condition logic
public/index.html          App shell and rules
public/app.js              Browser UI, actions, reconnects, polling
public/style.css           Responsive styling
public/field.svg            Original Minesweeper landscape artwork
public/favicon.svg         App icon
test/                      Game-rule and HTTP integration tests
.github/workflows/test.yml  GitHub Actions tests
render.yaml                Free Render web-service configuration
DEPLOY.md                  GitHub → Render instructions
TESTING.md                 Verification and iPhone test checklist
```

Run tests with `npm test`. For development with automatic server restarts, use `npm run dev` and refresh your browser after changes. `PORT` sets the HTTP port (default 3000); Render provides it automatically. The server listens on `0.0.0.0` for hosting.

## Hosting and storage limits

This initial version is intended for casual play on a **single server instance**. Rooms and scores live in memory; there is no persistent database. Server restarts, deployments, crashes, and free-host sleep remove every room. Idle rooms expire after one hour. It does not include permanent accounts, daily leaderboards, leagues, or historical statistics.

Player credentials are random bearer tokens stored in the player’s browser and sent only in authorization headers. Invite links contain only the room code. The server keeps hidden mines and the opponent’s tile positions private until the race ends; it validates all reveals, flags, scores, and results. Basic request and room limits are included. This does not prevent automation, multiple collaborating accounts, or all forms of cheating; it is not a cash-competition platform.

Refreshes and app switching reconnect on the same browser while the room and its saved credential still exist. Private-browsing cleanup or clearing site data loses that identity. Leaving a lobby returns home but keeps your seat available to resume; start a new room if you want a different rival. Races are not paused when a player switches apps or loses connectivity.

To scale across server instances or preserve games through restarts, move rooms to a shared durable store before increasing the instance count.

## Ownership

This source was created for your project and has no third-party runtime code. The original SVGs are included. No Daily Holes code, logos, or assets are bundled. `UNLICENSED` keeps the repository private/proprietary by default; add a license if you decide to publish it as open source.
