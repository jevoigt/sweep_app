# Verification

Run `npm test` using Node.js 22. No external services or packages are required. HTTP integration tests bind a random loopback port.

## Automated checks

The test suite covers:

- Exact Easy/Medium/Hard dimensions, mine counts, and neighboring numbers.
- Uniform sampling over every tile, including corners and center, with no protected region.
- All eight players start with zero revealed tiles on the same board, and a first-click mine freezes a zero score without relocation.
- Eight-player capacity and ninth-player rejection.
- Host-only start, minimum player count, all-player readiness, and no automatic early start.
- Host-only board choice, readiness reset, and settings locked during play.
- Frozen mine scores, multiple survivors continuing, strict last-survivor overtakes, all-player mine results, and tied top scores.
- First-clear immediate wins on Hard and later-move rejection.
- Lobby departures, host transfer, preserving a departed eliminated player’s frozen score, and concessions excluding scores.
- New-round lobbies, fresh boards, reset readiness, and retained wins.
- Hidden-board and credential privacy, flags, rectangular-board chording, and invalid inputs.
- Actual HTTP create/join/start/concede/new-lobby/leave flows with eight independent credentials, authentication, static assets, cross-origin rejection, and stale-round rejection.

## Browser checks

The development session checked the smiling-mine homepage, the board picker, an eight-player Hard game with 480 tiles, the next-round lobby and Medium selection, zoom controls, Fit, keyboard movement, mobile Flag mode, and reconnection after refresh. A rival move preserved the host’s horizontal and vertical board scroll positions. The board’s container holds the horizontal overflow instead of widening the page.

The browser used desktop Chromium with phone-sized layouts. This does not verify real iOS Safari/WebKit, actual hardware touch, browser suspension, or the native share sheet.

## iPhone Safari checklist

After deploying, test on two or more devices; use eight participants for the capacity check:

- [ ] Homepage shows the smiling mine and all three board choices.
- [ ] Easy has 9 rows × 9 columns / 10 mines; Medium 16 × 16 / 40; Hard 30 rows × 16 columns / 99.
- [ ] Native Share Invite includes the deployed HTTPS URL; joining by code or link works.
- [ ] Up to eight players can join; a ninth is rejected.
- [ ] Ready alone does not start early; the host starts only when at least two players have joined and everyone is ready.
- [ ] Changing board choice resets every player’s Ready state.
- [ ] Every player starts with all tiles hidden and a zero score. Mines can occur anywhere, and a first-click mine is allowed.
- [ ] Reveal and Flag work without right-clicking. Wrongly flagged chords can hit a mine.
- [ ] + / − resize tiles; Fit shows the full width; there is no Opening button.
- [ ] Swipe/drag scrolls large boards in both directions without accidentally revealing tiles.
- [ ] Rival score updates preserve the board’s scroll position and zoom.
- [ ] Swiping score cards and expanding standings show everyone’s progress.
- [ ] A mine freezes a score. Multiple survivors keep racing; the last survivor must exceed the highest frozen count.
- [ ] A full clear ends the race immediately. If everyone hits mines, highest score wins; tied top scores draw.
- [ ] The host can reopen a lobby after the result and select a different size.
- [ ] Refresh/app switching reconnects and preserves identity while the room exists. The race keeps running while someone is away.
- [ ] Pinch zoom, VoiceOver labels, text scaling, safe areas, and the rules dialog work in portrait and landscape.

On smaller phones, vertical page scrolling is expected for explanatory text and the lobby roster. Large boards also scroll inside their own viewport. Free-host restarts/sleep erase in-memory rooms; create a fresh room afterward.


## Gameplay music checks

The automated audio tests verify that home/lobby/countdown/results stay silent, a user gesture enables playback, only one music loop runs, mute preferences persist, background/disconnected sessions are silent, interrupted audio can resume, and unsupported audio does not break the game. The HTTP test verifies `music.js` is served.

On a real iPhone, additionally check that Ready/Start makes no sound in the lobby, music starts after the countdown, mute works and persists, switching apps silences it, and the Tap for music fallback resumes after Safari interruptions. Confirm the quiet volume and musical balance on physical speakers/headphones.

Browser verification confirmed silence during countdown, automatic playback after the countdown, mute/unmute, silence at the result, and removal of the music control when returning to the lobby. The native timer binding has a regression test.
