import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, act, view, advance, generateBoard, neighbors, SIZE, MINES, SAFE, CENTER, COUNTDOWN_MS } from '../game.mjs';

function fixture() {
  const room = createRoom('ABC234', 'Alice', 1000);
  joinRoom(room, 'Bob', 1000);
  room.phase = 'playing'; room.startAt = 1000;
  return { room, a: room.players[0], b: room.players[1] };
}
function safeIndices(room) { return room.board.flatMap((v, i) => v !== -1 ? [i] : []); }
function numbered(room) { return room.board.findIndex(v => v > 0); }

test('random boards have exactly twelve mines, valid counts, and a safe center', () => {
  for (let k = 0; k < 100; k++) {
    const board = generateBoard();
    assert.equal(board.length, SIZE * SIZE);
    assert.equal(board.filter(v => v === -1).length, MINES);
    assert.equal(board[CENTER], 0);
    for (const i of neighbors(CENTER)) assert.notEqual(board[i], -1);
    board.forEach((v, i) => { if (v !== -1) assert.equal(v, neighbors(i).filter(n => board[n] === -1).length); });
  }
});

test('both ready start a common countdown, identical safe openings, and independent boards', () => {
  const room = createRoom('ABC234', 'Alice', 1000);
  const a = room.players[0], b = joinRoom(room, 'Bob', 1000);
  act(room, a, { type: 'ready' }, 1100);
  assert.equal(room.phase, 'lobby');
  act(room, b, { type: 'ready' }, 1200);
  assert.equal(room.phase, 'countdown');
  assert.throws(() => act(room, a, { type: 'reveal', index: 0 }, 1300), /not in progress/);
  advance(room, 1200 + COUNTDOWN_MS);
  assert.equal(room.phase, 'playing');
  assert.deepEqual(a.revealed, b.revealed);
  assert.ok(a.revealed.size > 0 && a.revealed.size < SAFE);
  const untouched = room.board.findIndex((v, i) => v > 0 && !a.revealed.has(i));
  act(room, a, { type: 'reveal', index: untouched }, 4300);
  assert.equal(b.revealed.has(untouched), false);
});

test('a mine freezes the player while a trailing opponent continues', () => {
  const { room, a, b } = fixture();
  a.revealed = new Set(safeIndices(room).slice(0, 10));
  act(room, a, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.notEqual(a.hit, null);
  assert.equal(room.phase, 'playing');
  assert.throws(() => act(room, a, { type: 'flag', index: 1 }, 2001), /score is frozen/);
  assert.equal(b.hit, null);
});

test('survivor wins as soon as they pass the frozen score', () => {
  const { room, a, b } = fixture();
  a.hit = room.board.indexOf(-1); a.revealed = new Set();
  act(room, b, { type: 'reveal', index: numbered(room) }, 2000);
  assert.equal(room.phase, 'finished'); assert.equal(room.winner, b.id); assert.equal(room.reason, 'passed');
});

test('an opponent already ahead wins immediately when the other player hits a mine', () => {
  const { room, a, b } = fixture();
  b.revealed.add(numbered(room));
  act(room, a, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
  assert.equal(room.winner, b.id); assert.equal(room.phase, 'finished');
});

test('both hitting mines awards higher safe count; ties draw', () => {
  for (const tie of [false, true]) {
    const { room, a, b } = fixture();
    a.hit = room.board.indexOf(-1); a.revealed = new Set(safeIndices(room).slice(0, tie ? 0 : 5));
    act(room, b, { type: 'reveal', index: room.board.indexOf(-1) }, 2000);
    assert.equal(room.phase, 'finished'); assert.equal(room.reason, 'both-mines');
    assert.equal(room.winner, tie ? null : a.id);
  }
});

test('clearing every safe tile wins immediately and rejects later moves', () => {
  const { room, a, b } = fixture();
  const last = numbered(room);
  a.revealed = new Set(safeIndices(room).filter(i => i !== last));
  act(room, a, { type: 'reveal', index: last }, 2000);
  assert.equal(room.winner, a.id); assert.equal(room.reason, 'cleared'); assert.equal(a.wins, 1);
  assert.throws(() => act(room, b, { type: 'reveal', index: last }, 2000), /not in progress/);
});

test('flags do not score or reveal tiles and flagged tiles cannot be revealed', () => {
  const { room, a } = fixture(); const index = numbered(room);
  act(room, a, { type: 'flag', index }, 2000);
  act(room, a, { type: 'reveal', index }, 2001);
  assert.equal(a.revealed.size, 0); assert.equal(view(room, a, 2002).board[index], -3);
  act(room, a, { type: 'flag', index }, 2003);
  act(room, a, { type: 'reveal', index }, 2004);
  assert.equal(a.revealed.size, 1);
});

test('views hide mines, secret tokens, and the rival’s opened coordinates', () => {
  const { room, a, b } = fixture();
  b.revealed.add(numbered(room));
  const state = view(room, a, 2000), json = JSON.stringify(state);
  assert.ok(state.board.every(v => v === -2));
  assert.equal(state.players[1].revealed, 1);
  assert.equal(json.includes(a.token), false); assert.equal(json.includes(b.token), false);
  assert.equal('seed' in state, false);
});

test('rematch requires both players and clears board state while retaining match wins', () => {
  const { room, a, b } = fixture();
  act(room, b, { type: 'forfeit' }, 2000);
  act(room, a, { type: 'rematch' }, 2100);
  assert.equal(room.phase, 'finished');
  act(room, b, { type: 'rematch' }, 2200);
  assert.equal(room.phase, 'countdown'); assert.equal(room.round, 2); assert.equal(a.wins, 1);
  assert.equal(a.revealed.size, 0); assert.equal(a.hit, null); assert.equal(room.winner, null);
});

test('invalid tiles and third players are rejected', () => {
  const { room, a } = fixture();
  for (const index of [-1, 81, NaN, '3', 1.5, null]) assert.throws(() => act(room, a, { type: 'reveal', index }, 2000), /Invalid tile/);
  assert.throws(() => joinRoom(room, 'Third', 2000), /two players/);
});

test('chord with correct flags reveals safe neighbors', () => {
  const { room, a } = fixture();
  const i = numbered(room); a.revealed.add(i);
  for (const n of neighbors(i)) if (room.board[n] === -1) a.flags.add(n);
  act(room, a, { type: 'chord', index: i }, 2000);
  assert.equal(a.hit, null);
  for (const n of neighbors(i)) if (room.board[n] !== -1) assert.equal(a.revealed.has(n), true);
});
