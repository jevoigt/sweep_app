# Sweep Race

Live Minesweeper races for **2–8 players**, with private invite codes, identical boards, live scores, and three board sizes. The mobile interface keeps its rounded cards and soft green/blue styling, with an original smiling-mine homepage illustration.

**Already hosting this?** See [UPDATING.md](UPDATING.md). Upload these updated files into the same existing GitHub folder, then redeploy your existing Render service. Your public URL stays the same.

## Run locally

Install Node.js 22, open Terminal in this folder, and run:

```sh
npm start
```

Open http://localhost:3000. There are no external dependencies, build tools, API keys, or databases. On a Mac, `Start-Game.command` also starts the server. `npm run dev` watches server changes; refresh the browser after edits. `PORT` changes the default port of 3000; Render provides it automatically.

For two local browser players, use separate profiles/private windows, or `localhost:3000` and `127.0.0.1:3000`. Ordinary tabs on the same origin share the saved player identity. The automated integration test creates eight independent clients.

## Choose a board

| Difficulty | Rows | Columns | Mines | Safe tiles |
| --- | --- | --- | --- | --- |
| Easy | 9 | 9 | 10 | 71 |
| Medium | 16 | 16 | 40 | 216 |
| Hard | 30 | 16 | 99 | 381 |

The host chooses before creating the room and may change the choice in the lobby. Changing it resets everyone’s Ready status. Board dimensions are rows first: Hard is tall, **30 rows and 16 columns**.

Every round generates a fresh random board. Mines are sampled uniformly without replacement from **every tile**, with exactly the selected mine count. Every player gets the same layout, and **all tiles remain hidden when the countdown ends**. There is no protected region, starting reveal, or first-click safety: the first click can hit a mine. Safe zero tiles still reveal their connected area when a player clicks them during play. Boards are not guaranteed to be solvable without guessing.

## Play

1. Enter your name, choose a board, and create a room.
2. Share its six-character code or invite link with up to seven friends. A room holds at most eight players; at least two are required to start.
3. Everyone taps **I’m ready**. When the invited group has arrived, the host taps **Start race**. Readiness alone never starts the race early.
4. A shared three-second countdown starts the race with every tile hidden on everyone’s independent copy of the same board.
5. Reveal safe tiles. Use Flag mode to mark/unmark suspected mines; flags do not score. On desktop, right-click or press F on a focused tile. Arrow keys move through the board using its actual dimensions.
6. A numbered tile counts adjacent mines in all eight directions. Tap a revealed number with the matching number of adjacent flags to open its other neighbors. Incorrect flags can hit a mine.

## Winning with any number of players

- **First to clear every safe tile wins immediately**, ending the game for everyone.
- Hitting a mine freezes your safe-tile count; everyone else who is still active can continue.
- A survivor passing an eliminated player’s score does **not** end the race while multiple players are still active.
- When only one survivor remains, they win as soon as they strictly exceed every frozen score. If they were already ahead when the other players hit mines, they win immediately.
- If everyone hits a mine, the highest safe-tile count wins. Equal highest scores draw, even if lower-scoring players are also in the race.
- Conceding disqualifies your score. Leaving after hitting a mine preserves that frozen score. Leaving while still active concedes.
- There is no timer-based win condition. The elapsed timer keeps running when someone switches apps.
- Server arrival order decides nearly simultaneous moves. The server processes each move and its result before the next action.

After a result, the host can reopen the lobby with a fresh board. Players remain in the room and their match-win counts are kept; everyone marks Ready again. The host can change difficulty or invite replacement players before starting. Leaving a lobby frees your seat; if the host leaves, another remaining player becomes host.

## iPhone controls and large boards

- The **+ / −** buttons change tile sizes; **Fit** fits all columns into the visible width.
- Medium and Hard default to readable 36 px tiles, with horizontal and vertical scrolling inside the board. Larger options use 44 px and 52 px tiles. Fit may make cells small; zoom in again for accurate taps.
- Use the visible **Reveal / Flag** switch; no hover, long-press, or right-click is needed.
- The board stays mounted while other players’ scores change, preserving scroll position and touch interactions.
- Browser pinch zoom remains enabled. Form inputs use 16 px text, and the app includes safe-area spacing for iOS.
- Swipe the live score cards or expand **All players · standings** to see every player.
- Share Invite uses the native share sheet on supported HTTPS browsers, with a copy fallback.
- App switching pauses polling; coming back fetches the server’s authoritative state. Refreshing reconnects using a saved browser token while the room still exists.

Desktop Chromium was checked at mobile widths during development. Actual iOS Safari/WebKit, hardware touch, pinch behavior, and the native share sheet still need real-device testing; see [TESTING.md](TESTING.md).

## Music

An original synthesized elevator-style loop plays quietly during active gameplay only. The homepage, lobby, countdown, and result screens are silent. The in-game Music button mutes/unmutes it, and that preference is remembered on the device. Switching away from the tab or losing connection pauses music until the game reconnects.

The Ready/Start tap prepares Web Audio without playing anything in the lobby. Some browsers, particularly after reloading directly into a game or returning from another app, may still require a tap; the button then says **Tap for music**. No external music service, audio download, or copyrighted track is used. The composition lives in `public/music.js`.

## Files and checks

- `game.mjs`: server-authoritative generation, dimensions, room state, and win conditions.
- `server.mjs`: Node HTTP server, room API, authentication, and static files.
- `public/`: browser UI, styling, rules, and original SVG artwork.
- `test/`: meaningful board-generation, scoring, capacity, authentication, and HTTP lifecycle tests. Run `npm test`.
- `render.yaml`: a free single-instance Render Web Service configuration; build command `npm test`, start command `npm start`.
- `.github/workflows/test.yml`: optional GitHub test workflow, recognized when `.github` is at the repository root.
- [DEPLOY.md](DEPLOY.md): initial GitHub → Render setup.
- [UPDATING.md](UPDATING.md): update your existing deployed game.

## Hosting limits

Rooms are stored **in memory on one server**. Restarts, free-host sleep, crashes, or deployments remove active rooms. Idle rooms expire after an hour without activity. This version has no persistent accounts, history, leagues, or daily leaderboard. Do not increase the server instance count without introducing a shared durable store.

The server keeps hidden mines and other players’ tile positions private until the game ends. Player credentials are random bearer tokens stored in that player’s browser and sent in authorization headers, never invite links. All moves and scores are validated by the server; basic request/capacity limits are included. This does not prevent all automation or collusion.

This code and its SVG artwork were created for your project. No Daily Holes source, branding, or assets are included. `UNLICENSED` keeps the project proprietary unless you add another license.
