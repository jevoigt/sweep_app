import { randomInt, randomBytes } from 'node:crypto';

export const MAX_PLAYERS = 12;
export const COUNTDOWN_MS = 3000;
export const BOARD_OPTIONS = Object.freeze({
  easy: Object.freeze({ name: 'Easy', rows: 9, columns: 9, mines: 10 }),
  medium: Object.freeze({ name: 'Medium', rows: 16, columns: 16, mines: 40 }),
  hard: Object.freeze({ name: 'Hard', rows: 30, columns: 16, mines: 99 }),
});

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function neighbors(index, rows, columns) {
  const result = [], row = Math.floor(index / columns), col = index % columns;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < rows && c >= 0 && c < columns) result.push(r * columns + c);
  }
  return result;
}

function flood(board, rows, columns, revealed, flags, index) {
  const stack = [index];
  while (stack.length) {
    const cell = stack.pop();
    if (revealed.has(cell) || flags.has(cell) || board[cell] === -1) continue;
    revealed.add(cell);
    if (board[cell] === 0) stack.push(...neighbors(cell, rows, columns));
  }
}

export function generateBoard(settings, random = randomInt) {
  const { rows, columns, mines } = settings;
  const cells = Array.from({ length: rows * columns }, (_, i) => i);
  const board = Array(rows * columns).fill(0);
  // Uniform sampling without replacement across the entire board. No safe
  // region, retries for a preferred layout, or first-click mine relocation.
  for (let i = 0; i < mines; i++) {
    const j = random(i, cells.length);
    [cells[i], cells[j]] = [cells[j], cells[i]];
    board[cells[i]] = -1;
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) board[i] = neighbors(i, rows, columns).filter(n => board[n] === -1).length;
  }
  return { board };
}

export function newPlayer(name, now = Date.now()) {
  return { id: randomBytes(12).toString('hex'), token: randomBytes(32).toString('hex'), name,
    ready: false, revealed: new Set(), flags: new Set(), savedMine: null, hit: null, forfeited: false,
    left: false, wins: 0, seenAt: now };
}

export function boardSettings(difficulty, custom) {
  if (difficulty === 'custom') {
    const { rows, columns, mines } = custom || {};
    if (![rows, columns, mines].every(Number.isInteger) || rows < 1 || rows > 50 || columns < 1 || columns > 50 || mines < 0 || mines > rows * columns) {
      throw new GameError('Custom rows and columns must be whole numbers from 1 to 50. Mines must be from 0 to the total tile count.');
    }
    return { name: 'Custom', rows, columns, mines };
  }
  if (typeof difficulty !== 'string' || !Object.hasOwn(BOARD_OPTIONS, difficulty)) throw new GameError('Choose Easy, Medium, Hard, or Custom.');
  return BOARD_OPTIONS[difficulty];
}

function setBoard(room, difficulty, custom) {
  const config = boardSettings(difficulty, custom);
  Object.assign(room, config, { difficulty, safe: config.rows * config.columns - config.mines }, generateBoard(config));
  for (const p of room.players) {
    p.ready = false; p.revealed.clear(); p.flags.clear(); p.hit = null; p.savedMine = null; p.forfeited = false;
  }
}

export function createRoom(code, name, now = Date.now(), difficulty = 'easy', custom) {
  const host = newPlayer(name, now);
  const room = { code, players: [host], host: host.id, phase: 'lobby', startAt: null,
    endAt: null, mode: 'standard', winner: null, leaders: [], reason: null, round: 1, revision: 0,
    createdAt: now, touchedAt: now };
  setBoard(room, difficulty, custom);
  return room;
}

function finish(room, leaders, reason, now) {
  room.phase = 'finished'; room.leaders = leaders.map(p => p.id);
  room.winner = leaders.length === 1 ? leaders[0].id : null;
  room.reason = reason; room.endAt = now;
  if (leaders.length === 1) leaders[0].wins++;
  room.revision++;
}

function topScores(players) {
  const max = Math.max(...players.map(p => p.revealed.size));
  return players.filter(p => p.revealed.size === max);
}

function resolve(room, now) {
  const eligible = room.players.filter(p => !p.forfeited);
  const cleared = room.safe > 0 && eligible.find(p => p.revealed.size === room.safe);
  if (cleared) return finish(room, [cleared], 'cleared', now);
  if (room.kind === 'daily' || room.players.length === 1) {
    const player = room.players[0];
    if (player.hit !== null) finish(room, [], 'mine', now);
    else if (player.forfeited) finish(room, [], 'abandoned', now);
    return;
  }
  const alive = eligible.filter(p => p.hit === null);
  if (!alive.length) return finish(room, topScores(eligible), eligible.length ? 'all-mines' : 'forfeit', now);
  if (alive.length === 1) {
    const frozen = eligible.filter(p => p.hit !== null);
    if (frozen.every(p => alive[0].revealed.size > p.revealed.size)) {
      finish(room, alive, frozen.length ? 'passed' : 'forfeit', now);
    }
  }
}

export function advance(room, now = Date.now()) {
  if (room.phase === 'countdown' && now >= room.startAt) {
    room.phase = 'playing';
    room.revision++;
  }
}

export function joinRoom(room, name, now = Date.now()) {
  if (room.kind === 'daily') throw new GameError('Daily puzzles are solo. Create a multiplayer room to race friends.', 409);
  advance(room, now);
  if (room.players.filter(p => !p.left).length >= MAX_PLAYERS) throw new GameError('This room already has twelve players.', 409);
  if (room.phase !== 'lobby') throw new GameError('This race has already started.', 409);
  const player = newPlayer(name, now);
  room.players.push(player); room.revision++; room.touchedAt = now;
  return player;
}

export function leaveRoom(room, player, now = Date.now()) {
  advance(room, now);
  if (room.phase === 'lobby') room.players = room.players.filter(p => p.id !== player.id);
  else if (room.phase === 'finished') player.left = true;
  else {
    if (player.hit === null) player.forfeited = true;
    player.left = true;
    resolve(room, now);
  }
  if (room.host === player.id) room.host = room.players.find(p => !p.left)?.id ?? null;
  room.revision++; room.touchedAt = now;
}

function hitMine(room, player, index) {
  if (room.mode === 'one-life' && room.kind !== 'daily' && player.savedMine === null) {
    player.savedMine = index; player.flags.add(index);
  } else player.hit = index;
}

export function act(room, player, action, now = Date.now()) {
  advance(room, now);
  if (player.left) throw new GameError('You left this room.', 403);
  player.seenAt = now; room.touchedAt = now;
  if (room.kind === 'daily' && !['reveal', 'flag', 'chord', 'forfeit'].includes(action.type)) throw new GameError('That action is not available in a daily puzzle.', 409);
  if (action.type === 'ready') {
    if (room.phase !== 'lobby') throw new GameError('The race has already started.', 409);
    player.ready = !player.ready;
  } else if (action.type === 'start') {
    if (player.id !== room.host) throw new GameError('Only the host can start the race.', 403);
    if (room.phase !== 'lobby') throw new GameError('The race has already started.', 409);
    if (!room.players.every(p => p.ready)) throw new GameError('Everyone must be ready.', 409);
    room.phase = 'countdown'; room.startAt = now + COUNTDOWN_MS;
  } else if (action.type === 'mode') {
    if (player.id !== room.host) throw new GameError('Only the host can choose the mode.', 403);
    if (room.phase !== 'lobby') throw new GameError('Mode is locked during a race.', 409);
    if (!['standard', 'one-life'].includes(action.mode)) throw new GameError('Choose Standard or One life.');
    room.mode = action.mode;
    for (const p of room.players) p.ready = false;
  } else if (action.type === 'settings') {
    if (player.id !== room.host) throw new GameError('Only the host can choose the board.', 403);
    if (room.phase !== 'lobby') throw new GameError('Board settings are locked during a race.', 409);
    setBoard(room, action.difficulty, action.custom);
  } else if (action.type === 'lobby') {
    if (player.id !== room.host) throw new GameError('Only the host can open the next lobby.', 403);
    if (room.phase !== 'finished') throw new GameError('Finish this race first.', 409);
    room.players = room.players.filter(p => !p.left);
    setBoard(room, room.difficulty, room);
    room.round++; room.phase = 'lobby'; room.startAt = null; room.endAt = null;
    room.winner = null; room.leaders = []; room.reason = null;
  } else if (action.type === 'forfeit') {
    if (!['countdown', 'playing'].includes(room.phase)) throw new GameError('There is no active race.', 409);
    if (player.forfeited) throw new GameError('You already conceded.', 409);
    player.forfeited = true;
    resolve(room, now);
  } else {
    if (!['reveal', 'flag', 'chord'].includes(action.type)) throw new GameError('Unknown move.');
    if (room.phase !== 'playing') throw new GameError('The race is not in progress.', 409);
    if (player.hit !== null || player.forfeited) throw new GameError('Your score is frozen. You can watch the remaining players.', 409);
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i >= room.board.length) throw new GameError('Invalid tile.');
    if (action.type === 'flag') {
      if (!player.revealed.has(i) && i !== player.savedMine) {
        if (player.flags.has(i)) player.flags.delete(i);
        else if (player.flags.size < room.mines) player.flags.add(i);
      }
    } else if (action.type === 'chord') {
      if (player.revealed.has(i) && room.board[i] > 0 &&
          neighbors(i, room.rows, room.columns).filter(n => player.flags.has(n)).length === room.board[i]) {
        for (const n of neighbors(i, room.rows, room.columns)) {
          if (player.flags.has(n) || player.revealed.has(n)) continue;
          if (room.board[n] === -1) { hitMine(room, player, n); break; }
          flood(room.board, room.rows, room.columns, player.revealed, player.flags, n);
          if (player.revealed.size === room.safe) break;
        }
      }
    } else if (!player.flags.has(i) && !player.revealed.has(i)) {
      if (room.board[i] === -1) hitMine(room, player, i);
      else flood(room.board, room.rows, room.columns, player.revealed, player.flags, i);
    }
    resolve(room, now);
  }
  room.revision++;
}

export function view(room, player, now = Date.now()) {
  advance(room, now);
  return {
    code: room.code, phase: room.phase, round: room.round, revision: room.revision,
    serverNow: now, startAt: room.startAt, endAt: room.endAt, host: room.host, maxPlayers: MAX_PLAYERS,
    winner: room.winner, leaders: room.leaders, reason: room.reason, difficulty: room.difficulty,
    rows: room.rows, columns: room.columns, mines: room.mines, safe: room.safe, you: player.id,
    kind: room.kind || 'race', date: room.date || null, mode: room.mode, savedMine: player.savedMine,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, revealed: p.revealed.size,
      lifeUsed: p.savedMine !== null, hit: p.hit !== null, forfeited: p.forfeited, left: p.left, wins: p.wins, online: now - p.seenAt < 10000 })),
    board: room.board.map((value, i) => player.revealed.has(i) || i === player.hit || room.phase === 'finished' ? value : player.flags.has(i) ? -3 : -2),
    opened: [...player.revealed], flags: [...player.flags], hit: player.hit,
  };
}
