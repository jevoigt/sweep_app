import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, leaveRoom, act, view, advance, generateBoard, neighbors, BOARD_OPTIONS, MAX_PLAYERS, COUNTDOWN_MS } from '../game.mjs';

function fixture(count = 2, difficulty = 'easy') {
  const room = createRoom('ABC234', 'Player 1', 1000, difficulty);
  for (let i = 1; i < count; i++) joinRoom(room, `Player ${i + 1}`, 1000);
  room.phase = 'playing'; room.startAt = 1000;
  return { room, a: room.players[0], b: room.players[1], c: room.players[2] };
}
const safeIndices = room => room.board.flatMap((v, i) => v !== -1 ? [i] : []);
const numbered = room => room.board.findIndex(v => v > 0);
const score = (room, player, count) => { player.revealed = new Set(safeIndices(room).slice(0, count)); };

for (const [difficulty, settings] of Object.entries(BOARD_OPTIONS)) {
  test(`${difficulty}: exact dimensions/mine count and valid neighboring numbers`, () => {
    for (let k = 0; k < 40; k++) {
      const { board } = generateBoard(settings);
      assert.equal(board.length, settings.rows * settings.columns);
      assert.equal(board.filter(v => v === -1).length, settings.mines);
      board.forEach((v, i) => { if (v !== -1) assert.equal(v, neighbors(i, settings.rows, settings.columns).filter(n => board[n] === -1).length); });
    }
  });

  test(`${difficulty}: corners and center can all contain mines; no positions are excluded`, () => {
    const middle = Math.floor(settings.rows * settings.columns / 2);
    const last = settings.rows * settings.columns - 1;
    const choices = [middle, last, middle];
    let calls = 0;
    const { board } = generateBoard(settings, (min, max) => {
      assert.equal(max, settings.rows * settings.columns);
      const chosen = choices[calls++] ?? min;
      assert.ok(chosen >= min && chosen < max);
      return chosen;
    });
    assert.equal(calls, settings.mines);
    for (const i of [0, middle, last]) assert.equal(board[i], -1);
  });

  test(`${difficulty}: all twelve players start fully hidden on the same board with independent progress`, () => {
    const { room } = fixture(12, difficulty); room.phase = 'lobby';
    for (const p of room.players) act(room, p, { type: 'ready' }, 1100);
    assert.equal(room.phase, 'lobby', 'ready does not start early while more invites may be joining');
    act(room, room.players[0], { type: 'start' }, 1200);
    assert.equal(room.phase, 'countdown');
    assert.throws(() => act(room, room.players[0], { type: 'reveal', index: 0 }, 1300), /not in progress/);
    advance(room, 1200 + COUNTDOWN_MS);
    for (const p of room.players) {
      const state = view(room, p, 4200);
      assert.deepEqual(state.opened, []);
      assert.ok(state.board.every(v => v === -2));
      assert.equal(state.players.find(other => other.id === p.id).revealed, 0);
    }
    const i = room.board.findIndex((v, i) => v > 0 && !room.players[0].revealed.has(i));
    act(room, room.players[0], { type: 'reveal', index: i }, 4300);
    for (const p of room.players.slice(1)) assert.equal(p.revealed.has(i), false);
  });
}

test('twelve seats are available; a thirteenth player is rejected', () => {
  const { room } = fixture(12); room.phase = 'lobby';
  assert.equal(room.players.length, MAX_PLAYERS);
  assert.throws(() => joinRoom(room, 'Thirteenth', 1500), /twelve players/);
});

test('host controls start and everyone must be ready, including a solo host', () => {
  const room = createRoom('ABC234', 'Host', 1000), host = room.players[0];
  assert.throws(() => act(room, host, { type: 'start' }, 1001), /must be ready/);
  act(room, host, { type: 'ready' }, 1002);
  const guest = joinRoom(room, 'Guest', 1003);
  assert.throws(() => act(room, guest, { type: 'start' }, 1004), /Only the host/);
  assert.throws(() => act(room, host, { type: 'start' }, 1005), /everyone must be ready/i);
  act(room, guest, { type: 'ready' }, 1006);
  act(room, host, { type: 'start' }, 1007);
  assert.equal(room.phase, 'countdown');
  assert.throws(() => joinRoom(room, 'Late', 1008), /already started/);
});

test('only the host can change boards in the lobby; changing clears readiness', () => {
  const { room, a, b } = fixture(); room.phase = 'lobby';
  act(room, a, { type: 'ready' }, 1100); act(room, b, { type: 'ready' }, 1100);
  assert.throws(() => act(room, b, { type: 'settings', difficulty: 'hard' }, 1200), /Only the host/);
  act(room, a, { type: 'settings', difficulty: 'hard' }, 1300);
  assert.equal(room.rows, 30); assert.equal(room.columns, 16); assert.equal(room.mines, 99);
  assert.ok(room.players.every(p => !p.ready));
  assert.throws(() => act(room, a, { type: 'settings', difficulty: '__proto__' }, 1400), /Choose Easy/);
  room.phase = 'playing';
  assert.throws(() => act(room, a, { type: 'settings', difficulty: 'easy' }, 1500), /locked/);
});

test('a mine freezes a score and leaves all other players able to continue', () => {
  const { room, a } = fixture(12); score(room, a, 20);
  act(room, a, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.phase, 'playing'); assert.notEqual(a.hit, null);
  assert.throws(() => act(room, a, { type: 'flag', index: 0 }, 2100), /score is frozen/);
  for (const p of room.players.slice(1)) assert.equal(p.hit, null);
});

test('passing a frozen score does not end a race while several survivors remain', () => {
  const { room, a, b, c } = fixture(3);
  a.hit = room.board.indexOf(-1); score(room, a, 10); score(room, b, 11);
  act(room, b, { type: 'flag', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.phase, 'playing');
  act(room, c, { type: 'reveal', index: room.board.indexOf(-1) }, 2100);
  assert.equal(room.phase, 'finished'); assert.equal(room.winner, b.id); assert.equal(room.reason, 'passed');
});

test('last survivor must strictly exceed the highest frozen score', () => {
  const { room, a, b, c } = fixture(3);
  a.hit = b.hit = room.board.indexOf(-1); score(room, a, 20); score(room, b, 10); score(room, c, 20);
  act(room, c, { type: 'flag', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.phase, 'playing', 'equal score does not win');
  const index = numbered(room);
  c.revealed = new Set(safeIndices(room).filter(i => i !== index).slice(0, 20));
  act(room, c, { type: 'reveal', index }, 2100);
  assert.equal(room.winner, c.id); assert.equal(room.phase, 'finished');
});

test('two-player frozen-score rules are preserved', () => {
  const { room, a, b } = fixture(); score(room, a, 0); score(room, b, 1);
  act(room, a, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.winner, b.id); assert.equal(room.reason, 'passed');
});

test('when everyone hits a mine the highest safe score wins, even an earlier eliminated player', () => {
  const { room, a, b, c } = fixture(3);
  a.hit = b.hit = room.board.indexOf(-1); score(room, a, 20); score(room, b, 10); score(room, c, 5);
  act(room, c, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.winner, a.id); assert.equal(room.reason, 'all-mines');
});

test('equal highest frozen scores draw; lower scores are not listed as leaders', () => {
  const { room, a, b, c } = fixture(3);
  a.hit = b.hit = room.board.indexOf(-1); score(room, a, 20); score(room, b, 20); score(room, c, 5);
  act(room, c, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.winner, null); assert.deepEqual(room.leaders, [a.id, b.id]);
  assert.equal(a.wins, 0);
});

test('first full clear ends a twelve-player race and rejects subsequent moves', () => {
  const { room, a, b } = fixture(12, 'hard'); const last = numbered(room);
  a.revealed = new Set(safeIndices(room).filter(i => i !== last));
  act(room, a, { type: 'reveal', index: last }, 2000);
  assert.equal(room.winner, a.id); assert.equal(room.reason, 'cleared'); assert.equal(a.wins, 1);
  assert.throws(() => act(room, b, { type: 'reveal', index: last }, 2001), /not in progress/);
});

test('leaving a lobby frees a seat and transfers the host', () => {
  const { room, a, b } = fixture(12); room.phase = 'lobby';
  leaveRoom(room, a, 1200); assert.equal(room.players.length, 11); assert.equal(room.host, b.id);
  joinRoom(room, 'Replacement', 1300); assert.equal(room.players.length, 12);
});

test('leaving after hitting a mine preserves the frozen score', () => {
  const { room, a, b } = fixture(); a.hit = room.board.indexOf(-1); score(room, a, 20);
  leaveRoom(room, a, 2000);
  assert.equal(a.forfeited, false); assert.equal(room.phase, 'playing');
  act(room, b, { type: 'reveal', index: room.board.indexOf(-1) }, 2100);
  assert.equal(room.winner, a.id);
});

test('conceding cannot win by retaining a high score', () => {
  const { room, a, b, c } = fixture(3); score(room, a, 30);
  act(room, a, { type: 'forfeit' }, 2000); assert.equal(room.phase, 'playing');
  act(room, b, { type: 'forfeit' }, 2100);
  assert.equal(room.winner, c.id); assert.equal(a.wins, 0);
});

test('host reopens the lobby with fresh board/readiness while retaining wins', () => {
  const { room, a, b } = fixture();
  act(room, b, { type: 'forfeit' }, 2000);
  assert.throws(() => act(room, b, { type: 'lobby' }, 2100), /Only the host/);
  act(room, a, { type: 'lobby' }, 2200);
  assert.equal(room.phase, 'lobby'); assert.equal(room.round, 2); assert.equal(a.wins, 1);
  assert.ok(room.players.every(p => !p.ready && !p.forfeited && p.hit === null && !p.revealed.size));
  assert.equal(room.winner, null);
});

test('views hide mines, tokens, and other players’ tile positions until the race ends', () => {
  const { room, a, b } = fixture(); b.revealed.add(numbered(room));
  const state = view(room, a, 2000), text = JSON.stringify(state);
  assert.ok(state.board.every(v => v === -2)); assert.equal(state.players[1].revealed, 1);
  assert.equal(text.includes(a.token), false); assert.equal(text.includes(b.token), false);
  assert.equal('opening' in state, false); assert.equal('openingIndex' in state, false);
});

test('flags do not score and flagged safe tiles do not reveal until unmarked', () => {
  const { room, a } = fixture(); const index = numbered(room);
  act(room, a, { type: 'flag', index }, 2000); act(room, a, { type: 'reveal', index }, 2001);
  assert.equal(a.revealed.size, 0); assert.equal(view(room, a, 2002).board[index], -3);
  act(room, a, { type: 'flag', index }, 2003); act(room, a, { type: 'reveal', index }, 2004);
  assert.equal(a.revealed.size, 1);
});

test('chording respects the rectangular board’s actual row and column counts', () => {
  const { room, a } = fixture(2, 'hard'); const i = numbered(room); a.revealed.add(i);
  for (const n of neighbors(i, room.rows, room.columns)) if (room.board[n] === -1) a.flags.add(n);
  act(room, a, { type: 'chord', index: i }, 2000); assert.equal(a.hit, null);
  for (const n of neighbors(i, room.rows, room.columns)) if (room.board[n] !== -1) assert.equal(a.revealed.has(n), true);
});

test('invalid indices, unknown actions, and invalid board choices are rejected', () => {
  const { room, a } = fixture();
  for (const index of [-1, 81, NaN, '3', 1.5, null]) assert.throws(() => act(room, a, { type: 'reveal', index }, 2000), /Invalid tile/);
  assert.throws(() => act(room, a, { type: 'cheat' }, 2000), /Unknown move/);
  for (const difficulty of ['__proto__', 'other', 12, null, ['easy'], {}]) assert.throws(() => createRoom('XYZ234', 'Host', 1000, difficulty), /Choose Easy/);
});

test('incorrect flags can cause a mine hit when chording', () => {
  const { room, a } = fixture(3, 'hard');
  const index = room.board.findIndex((v, i) => v > 0 && neighbors(i, room.rows, room.columns).filter(n => room.board[n] !== -1).length >= v);
  a.revealed.add(index);
  for (const n of neighbors(index, room.rows, room.columns).filter(n => room.board[n] !== -1).slice(0, room.board[index])) a.flags.add(n);
  act(room, a, { type: 'chord', index }, 2000);
  assert.notEqual(a.hit, null); assert.equal(room.board[a.hit], -1);
});


test('a first-click mine freezes a zero score without relocating any mines', () => {
  const { room, a } = fixture(3);
  const original = [...room.board], mine = room.board.indexOf(-1);
  act(room, a, { type: 'reveal', index: mine }, 2000);
  assert.equal(a.hit, mine); assert.equal(a.revealed.size, 0);
  assert.deepEqual(room.board, original); assert.equal(room.phase, 'playing');
  const state = view(room, a, 2001);
  assert.equal(state.board[mine], -1);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`solo ${difficulty}: countdown, safe moves and flags do not award an early win; a mine ends the attempt`, () => {
    const room = createRoom('SOLO23', 'Solo', 1000, difficulty), player = room.players[0];
    act(room, player, {type:'ready'}, 1001);
    act(room, player, {type:'start'}, 1002);
    assert.equal(room.phase, 'countdown');
    advance(room, 1002 + COUNTDOWN_MS);
    act(room, player, {type:'flag', index:room.board.indexOf(-1)}, 5000);
    assert.equal(room.phase, 'playing'); assert.equal(room.winner, null);
    act(room, player, {type:'reveal', index:numbered(room)}, 5001);
    assert.equal(room.phase, 'playing');
    act(room, player, {type:'flag', index:room.board.indexOf(-1)}, 5002);
    act(room, player, {type:'reveal', index:room.board.indexOf(-1)}, 5003);
    assert.equal(room.phase, 'finished'); assert.equal(room.reason, 'mine');
    assert.equal(room.winner, null); assert.equal(player.wins, 0);
    act(room, player, {type:'lobby'}, 5004);
    assert.equal(room.phase, 'lobby'); assert.equal(room.round, 2); assert.equal(player.ready, false);
  });
}

test('solo clear wins and solo concession loses', () => {
  const {room, a} = fixture(1), last = numbered(room);
  a.revealed = new Set(safeIndices(room).filter(i => i !== last));
  act(room, a, {type:'reveal', index:last}, 2000);
  assert.equal(room.winner, a.id); assert.equal(a.wins, 1);
  act(room, a, {type:'lobby'}, 2001);
  act(room, a, {type:'ready'}, 2002);
  act(room, a, {type:'start'}, 2003);
  act(room, a, {type:'forfeit'}, 2004);
  assert.equal(room.phase, 'finished'); assert.equal(room.reason, 'abandoned');
  assert.equal(room.winner, null); assert.equal(a.wins, 1);
});
