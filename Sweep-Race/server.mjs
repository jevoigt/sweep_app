import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import { createRoom, joinRoom, leaveRoom, act, view, GameError } from './game.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const IDLE_MS = 60 * 60 * 1000;
const ROOM_LIMIT = 2000;
const ASSETS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/music.js': ['music.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/field.svg': ['field.svg', 'image/svg+xml'],
};

export function createGameServer() {
  const rooms = new Map();
  const limits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, room] of rooms) if (now - room.touchedAt > IDLE_MS) rooms.delete(key);
    for (const [key, entry] of limits) if (now - entry.at > 60000) limits.delete(key);
  }, 60000).unref();

  function limited(key, max, window = 60000) {
    const now = Date.now();
    let entry = limits.get(key);
    if (!entry || now - entry.at > window) { entry = { at: now, count: 0 }; limits.set(key, entry); }
    if (++entry.count > max) throw new GameError('Too many requests. Please wait a moment.', 429);
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    let data = '';
    for await (const chunk of req) {
      data += chunk;
      if (Buffer.byteLength(data) > 2048) throw new GameError('Request too large.', 413);
    }
    try {
      const parsed = JSON.parse(data);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      return parsed;
    } catch { throw new GameError('Invalid JSON.'); }
  }
  function cleanName(value) {
    const name = typeof value === 'string' ? value.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 20) : '';
    if (!name) throw new GameError('Enter a player name.');
    return name;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
      if (url.pathname.startsWith('/api/')) {
        // Browsers may only mutate their own origin. Credentials are bearer tokens,
        // never room codes, cookies, or values in URLs.
        if (req.headers.origin && req.headers.origin !== `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`) {
          throw new GameError('Cross-origin requests are not allowed.', 403);
        }
        if (!['GET', 'POST'].includes(req.method)) throw new GameError('Method not allowed.', 405);
        const address = req.socket.remoteAddress || 'unknown';
        // The global connection address is only a coarse upper bound behind a proxy.
        limited(`all:${address}`, 24000);
        if (req.method === 'POST' && url.pathname === '/api/rooms') {
          limited(`create:${address}`, 100);
          const input = await body(req);
          if (rooms.size >= ROOM_LIMIT) throw new GameError('The server is full. Try again later.', 503);
          let code;
          do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
          const room = createRoom(code, cleanName(input.name), Date.now(), input.difficulty ?? 'easy');
          rooms.set(code, room);
          return json(res, 201, { token: room.players[0].token, state: view(room, room.players[0]) });
        }
        const match = /^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|actions|leave))?$/.exec(url.pathname);
        if (!match) throw new GameError('Room not found. Check the invite code.', 404);
        const [, code, operation] = match;
        const room = rooms.get(code);
        if (!room || Date.now() - room.touchedAt > IDLE_MS) throw new GameError('This room expired or the server restarted. Create a new room.', 404);
        if (req.method === 'POST' && operation === 'join') {
          limited(`join:${address}`, 150);
          const input = await body(req);
          const player = joinRoom(room, cleanName(input.name));
          return json(res, 201, { token: player.token, state: view(room, player) });
        }
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        const player = room.players.find(p => p.token === token);
        if (!player || player.left) throw new GameError('Your player session is missing. Join with the invite code.', 401);
        limited(`player:${player.id}`, 900);
        if (req.method === 'POST' && operation === 'leave') {
          leaveRoom(room, player);
          if (!room.players.some(p => !p.left)) rooms.delete(code);
          return json(res, 200, { left: true });
        }
        if (req.method === 'GET' && !operation) {
          player.seenAt = Date.now(); room.touchedAt = Date.now();
          return json(res, 200, view(room, player));
        }
        if (req.method === 'POST' && operation === 'actions') {
          const input = await body(req);
          // Actions are synchronous after parsing; Node processes each move and
          // resolves its result atomically before the next player's action.
          // round prevents a delayed request from affecting a rematch.
          if (input.round !== room.round) throw new GameError('The round changed. Your board will refresh.', 409);
          act(room, player, input);
          return json(res, 200, view(room, player));
        }
        throw new GameError('Method not allowed.', 405);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new GameError('Method not allowed.', 405);
      const asset = ASSETS[url.pathname];
      if (!asset) throw new GameError('Page not found.', 404);
      const bytes = await readFile(new URL(`./public/${asset[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!(error instanceof GameError)) console.error('Request failed:', error.message);
      if (!res.headersSent) json(res, error.status || 500, { error: error instanceof GameError ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('close', () => clearInterval(sweep));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT || 3000);
  const server = createGameServer();
  server.listen(port, '0.0.0.0', () => console.log(`Sweep Race running at http://localhost:${port}`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
