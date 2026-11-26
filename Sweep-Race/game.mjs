import { randomInt, randomBytes } from 'node:crypto';

export const SIZE = 9;
export const MINES = 12;
export const CENTER = 40;
export const SAFE = SIZE * SIZE - MINES;
export const COUNTDOWN_MS = 3000;

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function neighbors(index) {
  const result = [];
  const row = Math.floor(index / SIZE), col = index % SIZE;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) result.push(r * SIZE + c);
  }
  return result;
}

function candidateBoard() {
  const excluded = new Set([CENTER, ...neighbors(CENTER)]);
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(i => !excluded.has(i));
  // Partial Fisher-Yates shuffle; randomness stays on the server.
  const board = Array(SIZE * SIZE).fill(0);
  for (let i = 0; i < MINES; i++) {
    const j = randomInt(i, cells.length);
    [cells[i], cells[j]] = [cells[j], cells[i]];
    board[cells[i]] = -1;
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) board[i] = neighbors(i).filter(n => board[n] === -1).length;
  }
  return board;
}

export function generateBoard() {
  // Keep the shared opening useful without letting it auto-clear a board.
  for (;;) {
    const board = candidateBoard();
    const player = { revealed: new Set(), flags: new Set() };
    flood({ board }, player, CENTER);
    if (player.revealed.size <= 40) return board;
  }
}

export function newPlayer(name) {
  return { id: randomBytes(12).toString('hex'), token: randomBytes(32).toString('hex'), name,
    ready: false, revealed: new Set(), flags: new Set(), hit: null, rematch: false, wins: 0, seenAt: Date.now() };
}

export function createRoom(code, name, now = Date.now()) {
  return { code, board: generateBoard(), players: [newPlayer(name)], phase: 'lobby',
    startAt: null, endAt: null, winner: null, reason: null, round: 1, revision: 0,
    createdAt: now, touchedAt: now };
}

function flood(room, player, index) {
  const stack = [index];
  while (stack.length) {
    const cell = stack.pop();
    if (player.revealed.has(cell) || player.flags.has(cell) || room.board[cell] === -1) continue;
    player.revealed.add(cell);
    if (room.board[cell] === 0) stack.push(...neighbors(cell));
  }
}

function finish(room, winner, reason, now) {
  room.phase = 'finished'; room.winner = winner?.id ?? null; room.reason = reason; room.endAt = now;
  if (winner) winner.wins++;
  room.revision++;
}

function mostTiles(room) {
  const [a, b] = room.players;
  return a.revealed.size === b.revealed.size ? null : a.revealed.size > b.revealed.size ? a : b;
}

function resolve(room, now) {
  const cleared = room.players.find(p => p.revealed.size === SAFE);
  if (cleared) return finish(room, cleared, 'cleared', now);
  if (room.players.every(p => p.hit !== null)) return finish(room, mostTiles(room), 'both-mines', now);
  const busted = room.players.find(p => p.hit !== null);
  const alive = room.players.find(p => p.hit === null);
  if (busted && alive.revealed.size > busted.revealed.size) finish(room, alive, 'passed', now);
}

export function advance(room, now = Date.now()) {
  if (room.phase === 'countdown' && now >= room.startAt) {
    room.phase = 'playing';
    // Both boards open the same safe area at the same instant.
    for (const player of room.players) flood(room, player, CENTER);
    room.revision++;
  }
}

export function joinRoom(room, name, now = Date.now()) {
  advance(room, now);
  if (room.players.length >= 2) throw new GameError('This room already has two players.', 409);
  if (room.phase !== 'lobby') throw new GameError('This race has already started.', 409);
  const player = newPlayer(name);
  room.players.push(player); room.revision++; room.touchedAt = now;
  return player;
}

export function act(room, player, action, now = Date.now()) {
  advance(room, now);
  player.seenAt = now; room.touchedAt = now;
  if (action.type === 'ready') {
    if (room.phase !== 'lobby') throw new GameError('The race has already started.', 409);
    player.ready = !player.ready;
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.phase = 'countdown'; room.startAt = now + COUNTDOWN_MS;
    }
  } else if (action.type === 'rematch') {
    if (room.phase !== 'finished') throw new GameError('Finish this race first.', 409);
    player.rematch = true;
    if (room.players.length === 2 && room.players.every(p => p.rematch)) {
      room.board = generateBoard(); room.round++; room.phase = 'countdown';
      room.startAt = now + COUNTDOWN_MS; room.endAt = null; room.winner = null; room.reason = null;
      for (const p of room.players) {
        p.revealed.clear(); p.flags.clear(); p.hit = null; p.rematch = false; p.ready = true;
      }
    }
  } else if (action.type === 'forfeit') {
    if (!['countdown', 'playing'].includes(room.phase)) throw new GameError('There is no active race.', 409);
    finish(room, room.players.find(p => p.id !== player.id), 'forfeit', now);
  } else {
    if (!['reveal', 'flag', 'chord'].includes(action.type)) throw new GameError('Unknown move.');
    if (room.phase !== 'playing') throw new GameError('The race is not in progress.', 409);
    if (player.hit !== null) throw new GameError('You hit a mine. Your score is frozen.', 409);
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i >= room.board.length) throw new GameError('Invalid tile.');
    if (action.type === 'flag') {
      if (!player.revealed.has(i)) {
        if (player.flags.has(i)) player.flags.delete(i);
        else if (player.flags.size < MINES) player.flags.add(i);
      }
    } else if (action.type === 'chord') {
      // Revealing a numbered tile with the matching number of adjacent flags
      // opens its remaining neighbors. Incorrect flags can hit a mine.
      if (player.revealed.has(i) && room.board[i] > 0 &&
          neighbors(i).filter(n => player.flags.has(n)).length === room.board[i]) {
        for (const n of neighbors(i)) {
          if (player.flags.has(n) || player.revealed.has(n)) continue;
          if (room.board[n] === -1) { player.hit = n; break; }
          flood(room, player, n);
          if (player.revealed.size === SAFE) break;
        }
      }
    } else if (!player.flags.has(i) && !player.revealed.has(i)) {
      if (room.board[i] === -1) player.hit = i;
      else flood(room, player, i);
    }
    resolve(room, now);
  }
  room.revision++;
}

export function view(room, player, now = Date.now()) {
  advance(room, now);
  return {
    code: room.code, phase: room.phase, round: room.round, revision: room.revision,
    serverNow: now, startAt: room.startAt, endAt: room.endAt,
    winner: room.winner, reason: room.reason, size: SIZE, mines: MINES, safe: SAFE, you: player.id,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, revealed: p.revealed.size,
      hit: p.hit !== null, rematch: p.rematch, wins: p.wins, online: now - p.seenAt < 10000 })),
    // Never send unrevealed mines or the opponent's board during a race.
    board: room.board.map((value, i) => player.revealed.has(i) || i === player.hit || room.phase === 'finished' ? value : player.flags.has(i) ? -3 : -2),
    opened: [...player.revealed], flags: [...player.flags], hit: player.hit,
  };
}
