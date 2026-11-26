# Verification

Run `npm test` using Node.js 22. No external services or packages are required. HTTP integration tests bind a random loopback port.

## Automated checks

The test suite covers:

- Exact Easy/Medium/Hard dimensions, mine counts, and neighboring numbers.
- Uniform sampling over every tile, including corners and center, with no protected region.
- All twelve players start with zero revealed tiles on the same board, and a first-click mine freezes a zero score without relocation.
- Twelve-player capacity and thirteenth-player rejection.
- Host-only start, minimum player count, all-player readiness, and no automatic early start.
- Host-only board choice, readiness reset, and settings locked during play.
- Frozen mine scores, multiple survivors continuing, strict last-survivor overtakes, all-player mine results, and tied top scores.
- First-clear immediate wins on Hard and later-move rejection.
- Lobby departures, host transfer, preserving a departed eliminated player’s frozen score, and concessions excluding scores.
- New-round lobbies, fresh boards, reset readiness, and retained wins.
- Hidden-board and credential privacy, flags, rectangular-board chording, and invalid inputs.
- Actual HTTP create/join/start/concede/new-lobby/leave flows with twelve independent credentials, authentication, static assets, cross-origin rejection, and stale-round rejection.

## Browser checks

The development session checked the smiling-mine homepage, the board picker, an twelve-player Hard game with 480 tiles, the next-round lobby and Medium selection, zoom controls, Fit, keyboard movement, tap/hold tile controls, and reconnection after refresh. A rival move preserved the host’s horizontal and vertical board scroll positions. The board’s container holds the horizontal overflow instead of widening the page.

The browser used desktop Chromium with phone-sized layouts. This does not verify real iOS Safari/WebKit, actual hardware touch, browser suspension, or the native share sheet.

## iPhone Safari checklist

After deploying, test on two or more devices; use twelve participants for the capacity check:

- [ ] Homepage shows the smiling mine and the three presets and Custom option.
- [ ] Easy has 9 rows × 9 columns / 10 mines; Medium 16 × 16 / 40; Hard 30 rows × 16 columns / 99.
- [ ] Native Share Invite includes the deployed HTTPS URL; joining by code or link works.
- [ ] Up to twelve players can join; a thirteenth is rejected.
- [ ] Ready alone does not start early; the host can start alone once ready, or start a multiplayer race when everyone is ready.
- [ ] Changing board choice resets every player’s Ready state.
- [ ] Every player starts with all tiles hidden and a zero score. Mines can occur anywhere, and a first-click mine is allowed.
- [ ] A quick tap reveals exactly once; a stationary hold flags exactly once and does not reveal on release.
- [ ] Holding a flagged tile unflags it; tapping a flagged tile does not reveal it.
- [ ] Dragging, scrolling, pointer cancellation, app switching, and two-finger pinch cancel an unfinished hold without flagging/revealing.
- [ ] Desktop right-click and keyboard F still flag. Wrongly flagged chords can hit a mine.
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

Gesture-state tests cover short taps, holds, release-click suppression, dragging, pointer cancellation, multi-touch, later intentional taps, and keyboard activation. Real iOS Safari hold/callout behavior should also be checked on a device.

Browser gesture verification passed: a 650 ms press flagged without revealing, tapping the flagged tile kept it protected, another hold unflagged it, and a short tap revealed normally. Dragging did not change revealed/flag counts. At 390 px width there was no horizontal page overflow and no mode buttons remained. These checks used a desktop browser; physical iOS touch/callout checks remain on the device checklist.


## Daily, Custom, explosion, and icon update

Automated tests cover fixed-EST date boundaries in winter and summer, daily layout determinism/date changes, solo clear/mine/end outcomes, elapsed times, browser-journal persistence and retry counts, failure denominator and snark formatting, exact 50×50 generation, server-side custom bounds and guest restrictions, all-mine/zero-mine cases, settings across new rounds, explosion context/mute behavior, and the actual daily HTTP endpoints.

Browser verification passed for a fully hidden 256-tile daily start, mine failure, retry #2 on the same board, copied snarky results, attempt count after reload and tab navigation, rejection of 2,501 mines on 50×50, and a running 2,500-tile Custom race. At a 390 px viewport, the page stayed 390 px wide while the 1,996 px board scrolled inside its container. No browser errors were recorded. The host-selected 50 rows / 50 columns / 400 mines were identical in the guest’s state.

On real iOS Safari, additionally check the explosion’s volume and sound-mode behavior, always-enabled explosion effects and the Music toggle, the Daily tab and clipboard copy, reload/resume without an extra attempt, host-only custom controls, and large-board touch scrolling/holding. Favicon caching may require reloading the site.


## Five-track MP3 playlist update

Tests verify the exact supplied order, fifth-to-first wraparound, silence during audio priming/lobby/countdown/results, fresh-game reset, mute persistence, elapsed-position resume, blocked-playback recovery, and cancellation of late playback promises. Actual HTTP tests verify all five files, MP3 MIME type, HEAD requests, the two-byte range probe used by mobile playback, suffix ranges, invalid ranges, and rejection of unknown/traversal paths. File durations and valid MP3 format were read with the operating system’s audio inspector.

On iPhone Safari, play a full round long enough to hear several transitions, verify the final track loops to the first, and check pause/mute/app switching and Tap for music fallback. Confirm that the lobby stays silent even after Ready.

Browser playback verification passed with the actual MP3 files: Kokiri Forest started during gameplay, automatically advanced to Shop when it ended, mute/resume worked, and audio stopped at the result. The Daily menu had no playback controls or music. A mobile-sized preview displays the current numbered track. Physical iOS testing is still recommended.

## Version 1.6 checks

The twelve-client HTTP lifecycle covers capacity, readiness, host start, winner resolution, seat replacement, and stale moves. Explosion tests include old muted preferences and muted music. Completed games show green for the winner, red for losses, and amber for tied leaders.

Browser verification for this update: twelve players joined, the host started the race, only the Music control appeared, and the host’s completed win used the green result class. The browser stalled during the concession flow, so visual confirmation of the red loss state remains outstanding. Real iOS audio behavior still requires device testing.

Solo regression checks cover the host-only countdown, safe reveals and flagging without an early win, clearing the board, hitting a mine, conceding, replaying, and HTTP start authorization.

Version 1.7: 74 automated tests passed. Browser verification confirmed the homepage “2–12 players / Or play solo” label, an enabled “Start race · 1 player” control after Ready, and the active solo board.

Version 1.8: all 80 tests passed, including host mode permissions, readiness reset, twelve independent extra lives, private saved coordinates, protected flag locking, chording, full clear after using a life, next-round reset, Standard and Daily regression checks. Mobile browser preview verified the mode selector, a pink flagged first mine while play continues, and loss on a second mine.
