import { createHash } from 'node:crypto';
import { createRoom, generateBoard, BOARD_OPTIONS } from './game.mjs';

const DAY = 86400000, EST = 5 * 3600000;
export function dailyDate(now = Date.now()) { return new Date(now - EST).toISOString().slice(0, 10); }
export function dailyReset(now = Date.now()) {
  return Date.parse(`${dailyDate(now)}T00:00:00Z`) + DAY + EST;
}

// Stable across process restarts and deployments. Rejection sampling avoids
// modulo bias while giving everyone exactly the same dated layout.
export function datedBoard(date) {
  let counter = 0;
  return generateBoard(BOARD_OPTIONS.medium, (min, max) => {
    const range = max - min, limit = 2 ** 32 - (2 ** 32 % range);
    let value;
    do { value = createHash('sha256').update(`SweepRaceDaily-v1:${date}:${counter++}`).digest().readUInt32BE(0); } while (value >= limit);
    return min + value % range;
  }).board;
}

export function createDailyRoom(code, name, now = Date.now()) {
  const room = createRoom(code, name, now, 'medium');
  room.kind = 'daily'; room.date = dailyDate(now); room.board = datedBoard(room.date);
  room.phase = 'playing'; room.startAt = now;
  return room;
}
