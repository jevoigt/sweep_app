# Verification

## Automated checks

Run `npm test` with Node.js 22 or later. The tests use Node’s built-in test runner and real HTTP connections on a random loopback port. They need no external accounts or services.

Coverage includes board generation, identical openings, synchronized start, independent player boards, frozen mine scores, survivor overtakes, both-player mine outcomes, ties, clearing a board, flags, chording, hidden-board privacy, rematches, invalid moves, third-player rejection, HTTP authentication, static assets, cross-origin rejection, and stale-round rejection.

## Browser checks performed

The development check used two separate browser origins as two players. It verified room creation, invite-code joining, Ready/countdown, identical openings, touch-style Flag/Reveal controls, a mine freezing the first score, the surviving player winning by passing it, a mutually accepted rematch, the rules dialog, and reconnecting after refresh. Layouts at 320 px and 390 px widths were checked for horizontal overflow.

The browser used Chromium. Viewport testing does **not** replace testing real Safari/WebKit, iOS safe areas, hardware touch, browser suspension, or the native share sheet.

## Real iPhone Safari acceptance checklist

Use the deployed HTTPS URL on two separate phones, or one phone and a desktop:

- [ ] Enter a name without Safari unexpectedly zooming the form.
- [ ] Create a room; copy its code; join by code on the other device.
- [ ] Share Invite opens the native share sheet and shares the correct public URL.
- [ ] Opening an invite link pre-fills the code and asks for the second player’s name.
- [ ] Both Ready buttons lead to the shared countdown and identical opening tiles.
- [ ] Board fits in portrait at iPhone SE and regular iPhone widths without horizontal scrolling.
- [ ] Tap Reveal and Flag modes repeatedly; flags mark/unmark and never add points.
- [ ] Safe-tile counts update on the other device in about a second under normal network conditions.
- [ ] A mine freezes the player’s score; the other player can keep playing until they pass it or hit a mine.
- [ ] Both-player mine ties show a draw; the higher count otherwise wins.
- [ ] Clearing all safe tiles ends the match for both players.
- [ ] Both accept a rematch; the board resets and match wins remain.
- [ ] Refreshing preserves the player’s identity while the room exists.
- [ ] Switching apps and coming back reconnects; the race timer continues rather than pausing.
- [ ] Temporarily disconnect the network, reconnect, and confirm the server’s state returns without duplicated points.
- [ ] Rules dialog scrolls and closes in portrait and landscape.
- [ ] Pinch zoom, VoiceOver labels, and browser text scaling remain usable.
- [ ] No important controls are hidden by the notch, home indicator, or browser toolbar.

The smallest portrait phones may require vertical scrolling to see explanatory text and the bottom navigation; the board itself stays within the page width.
