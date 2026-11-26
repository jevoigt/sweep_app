# Sweep Race

Solo Minesweeper and live races for **2–12 players**, with private invite codes, identical boards, live scores, three preset board sizes, host-defined custom boards, and a shareable solo Daily puzzle. The mobile interface keeps its rounded cards and soft green/blue styling, with an original smiling-mine homepage illustration.

**Already hosting this?** See [UPDATING.md](UPDATING.md). Upload these updated files into the same existing GitHub folder, then redeploy your existing Render service. Your public URL stays the same.

## Run locally

Install Node.js 22, open Terminal in this folder, and run:

```sh
npm start
```

Open http://localhost:3000. There are no external dependencies, build tools, API keys, or databases. On a Mac, `Start-Game.command` also starts the server. `npm run dev` watches server changes; refresh the browser after edits. `PORT` changes the default port of 3000; Render provides it automatically.

For two local browser players, use separate profiles/private windows, or `localhost:3000` and `127.0.0.1:3000`. Ordinary tabs on the same origin share the saved player identity. The automated integration test creates twelve independent clients.

## Choose a board

| Difficulty | Rows | Columns | Mines | Safe tiles |
| --- | --- | --- | --- | --- |
| Easy | 9 | 9 | 10 | 71 |
| Medium | 16 | 16 | 40 | 216 |
| Hard | 30 | 16 | 99 | 381 |
| Custom | 1–50 | 1–50 | 0 to rows × columns | Total tiles minus mines |

For Custom, the host sets **rows, columns, and mine count**; guests cannot edit them. The server validates integer dimensions from 1 through 50 and rejects negative or excessive mine counts before generating the board. Equality is allowed: a board with one mine per tile has no possible full clear, so normal elimination/scoring decides it. Zero-mine boards are also allowed.

The host chooses before creating the room and may change the choice in the lobby. Changing it resets everyone’s Ready status. Board dimensions are rows first: Hard is tall, **30 rows and 16 columns**.

Every round generates a fresh random board. Mines are sampled uniformly without replacement from **every tile**, with exactly the selected mine count. Every player gets the same layout, and **all tiles remain hidden when the countdown ends**. There is no protected region, starting reveal, or first-click safety: the first click can hit a mine. Safe zero tiles still reveal their connected area when a player clicks them during play. Boards are not guaranteed to be solvable without guessing.

## Play

1. Enter your name, choose a board, and create a room.
2. Share its six-character code or invite link with up to eleven friends. A room holds at most twelve players; the host can also start alone to play solo.
3. Everyone taps **I’m ready**. When the invited group has arrived, the host taps **Start race**. Readiness alone never starts the race early.
4. A shared three-second countdown starts the race with every tile hidden on everyone’s independent copy of the same board.
5. Tap a tile to reveal it. Hold a covered tile still for about half a second to flag or unflag it; flags do not score. On desktop, right-click or press F on a focused tile. Arrow keys move through the board using its actual dimensions.
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
- Medium, Hard, and large Custom boards default to readable 36 px tiles, with horizontal and vertical scrolling inside the board. Larger options use 44 px and 52 px tiles. Fit may make cells small; zoom in again for accurate taps.
- **Tap to reveal; hold to flag/unflag.** There is no mode switch. A hold takes about half a second and never also reveals the tile. Moving your finger, scrolling, cancelling the pointer, or adding another finger cancels the hold; pinch zoom and native scrolling stay available.
- The board stays mounted while other players’ scores change, preserving scroll position and touch interactions.
- Browser pinch zoom remains enabled. Form inputs use 16 px text, and the app includes safe-area spacing for iOS.
- Swipe the live score cards or expand **All players · standings** to see every player.
- Share Invite uses the native share sheet on supported HTTPS browsers, with a copy fallback.
- App switching pauses polling; coming back fetches the server’s authoritative state. Refreshing reconnects using a saved browser token while the room still exists.

Desktop Chromium was checked at mobile widths during development. Actual iOS Safari/WebKit, hardware touch, pinch behavior, and the native share sheet still need real-device testing; see [TESTING.md](TESTING.md).

## Daily puzzle

Use the **DAILY** tab or open `/?daily=1`. Everyone gets the same **16 × 16 Medium board with 40 mines**, all tiles initially hidden. The date changes at **12:00 AM fixed EST (UTC−5), exactly 05:00 UTC, year-round**. It intentionally does not follow daylight saving time. Boards are derived deterministically from the EST date and remain identical across server restarts and deployments; no scheduled server job or database is required.

Tap Start to begin an attempt. The timer starts then and continues through app switching, returning to the menu, or refreshing. Reopening/resuming that run does not add an attempt. A mine ends the solo attempt immediately. End attempt voluntarily to record an unfinished run. A full clear ends with a completion time.

**Copy daily results** shares the date, result, and attempt count. A successful result includes elapsed time. A failed/unfinished result includes revealed **safe tiles out of the whole 256-tile board**, explicitly labeled; 216 safe tiles are available. Attempts after the first add a snarky line. Retry uses the same dated board, increments the count, and keeps previous attempts recorded.

Attempt logs and results are saved **in the same browser’s local storage**, not in a global account. Clearing browser data, using private browsing, another browser, or another device creates a separate record. These are casual, self-reported shares, not verified competitive rankings. Multiple tabs using the same site share the saved log; supported browsers serialize attempt creation with Web Locks.

Active runs still live in server memory. If the server restarts, the browser retains its attempt count and last recorded safe-tile progress, marks the lost run interrupted, and lets you copy it or start the next counted attempt on the same daily board. An open run may finish after midnight and share its original date; the interface offers the new daily separately.

## Gameplay MP3 playlist

Each new multiplayer round or Daily attempt shuffles these five supplied songs:

1. Kokiri Forest — `06 Kokiri Forest.mp3`
2. Shop — `10 Shop.mp3`
3. Market — `21 Market.mp3`
4. Kakariko Village — `30 Kakariko Village.mp3`
5. Ocarina of Time — `81 Ocarina of Time.mp3`

After track 5, it repeats from track 1 for the rest of that game. The homepage, lobby, countdown, and result screens have no audible music. The Music button remembers mute, and the game displays the current track. Muting or switching away pauses audio; returning rejoins approximately the current game’s playlist position using the server’s elapsed timer. It is not sample-accurate synchronization across devices.

The original supplied MP3s are bundled unchanged in `public/music/`; `public/playlist.js` declares the available songs, titles, and durations. `public/music.js` controls playback. All five assets must be uploaded to GitHub and deployed with the code. The Node server streams them with byte-range/HEAD support for mobile browsers, rather than loading the entire playlist into memory. Media bytes count toward your hosting bandwidth usage.

The Ready/Start tap prepares browser audio through a silent output. Some browsers, particularly after a refresh or app interruption, may still require **Tap for music**. On a real iPhone, check playback, volume, silent-mode behavior, and transitions on the device.

The MP3 files were supplied by the project owner. Their inclusion does not establish or grant any music rights; no tracks were fetched or converted from YouTube by this project update.

## Explosion effect

Revealing a mine plays a short original synthesized explosion, only for the player who hit it. Repeated polling or loading a finished board does not replay it. Explosion effects are always enabled, independent of the Music toggle; there is no Sound button. Ready/Start/tile taps prepare audio under browser autoplay rules. Physical iPhone volume, silent-mode, and audio behavior still need device testing.

The header and browser favicon now use the simple smiling-mine SVG at `public/favicon.svg`.

## Files and checks

- `game.mjs`: server-authoritative generation, dimensions, room state, and win conditions.
- `server.mjs`: Node HTTP server, room/daily API, authentication, and static files.
- `daily.mjs`: fixed-EST date/reset logic and deterministic daily boards.
- `public/daily-results.js`: browser attempt journal and result formatting.
- `public/effects.js`: independent explosion audio.
- `public/`: browser UI, styling, rules, and original SVG artwork.
- `test/`: meaningful board-generation, scoring, capacity, authentication, and HTTP lifecycle tests. Run `npm test`.
- `render.yaml`: a free single-instance Render Web Service configuration; build command `npm test`, start command `npm start`.
- `.github/workflows/test.yml`: optional GitHub test workflow, recognized when `.github` is at the repository root.
- [DEPLOY.md](DEPLOY.md): initial GitHub → Render setup.
- [UPDATING.md](UPDATING.md): update your existing deployed game.

## Hosting limits

Rooms are stored **in memory on one server**. Restarts, free-host sleep, crashes, or deployments remove active rooms. Idle rooms expire after an hour without activity. This version has no persistent accounts, server-side history, leagues, or daily leaderboard. Daily attempt logs/results remain browser-local, subject to browser storage availability. Do not increase the server instance count without introducing a shared durable store.

The server keeps hidden mines and other players’ tile positions private until the game ends. Player credentials are random bearer tokens stored in that player’s browser and sent in authorization headers, never invite links. All moves and scores are validated by the server; basic request/capacity limits are included. This does not prevent all automation or collusion.

This code and its SVG artwork were created for your project. No Daily Holes source, branding, or assets are included. `UNLICENSED` keeps the project proprietary unless you add another license.

## Standard and One life modes

In the lobby, the host chooses Standard (default) or One life. One life grants each player one protected mine hit: the mine is automatically flagged, stays pink, and cannot be unflagged. A second mine freezes their score or ends a solo attempt. A protected mine never scores as a safe tile. Mode changes reset readiness; mode stays selected for the next round and each player gets a fresh life. Daily puzzles keep Standard rules.

## Shuffled game music

The same five MP3s now play in a shuffled order each game, looping after all five have played. Players in the same room/round share the order; refreshing, muting, or reconnecting preserves that game’s order. New rounds and Daily attempts get a fresh shuffle.
