import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server.mjs';

test('HTTP lifecycle: create, join, authenticate, ready, forfeit, rematch, reject stale moves', async t => {
  const server = createGameServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, data, token) {
    const response = await fetch(base + path, { method: data ? 'POST' : 'GET',
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await fetch(base + '/')).status, 200);
  for (const asset of ['/app.js', '/style.css', '/field.svg', '/favicon.svg', '/health']) assert.equal((await fetch(base + asset)).status, 200);
  const a = await req('/api/rooms', { name: 'Alice' });
  assert.equal(a.status, 201);
  const path = '/api/rooms/' + a.data.state.code;
  const b = await req(path + '/join', { name: 'Bob' });
  assert.equal(b.status, 201);
  assert.equal((await req(path + '/join', { name: 'Third' })).status, 409);
  assert.equal((await req(path)).status, 401);
  const state = await req(path, null, a.data.token);
  assert.equal(state.data.players.length, 2); assert.ok(state.data.board.every(v => v === -2));
  assert.equal(JSON.stringify(state.data).includes(b.data.token), false);
  await req(path + '/actions', { type: 'ready', round: 1 }, a.data.token);
  const ready = await req(path + '/actions', { type: 'ready', round: 1 }, b.data.token);
  assert.equal(ready.data.phase, 'countdown');
  const win = await req(path + '/actions', { type: 'forfeit', round: 1 }, a.data.token);
  assert.equal(win.data.winner, b.data.state.you); assert.equal(win.data.phase, 'finished');
  await req(path + '/actions', { type: 'rematch', round: 1 }, a.data.token);
  const replay = await req(path + '/actions', { type: 'rematch', round: 1 }, b.data.token);
  assert.equal(replay.data.round, 2);
  assert.equal((await req(path + '/actions', { type: 'reveal', index: 0, round: 1 }, a.data.token)).status, 409);
  const rejected = await fetch(base + path + '/actions', { method: 'POST', headers: { Origin: 'https://unrelated.example', Authorization: `Bearer ${a.data.token}` }, body: '{}' });
  assert.equal(rejected.status, 403);
  const malformed = await fetch(base + '/api/rooms', { method: 'POST', body: 'null' });
  assert.equal(malformed.status, 400);
});
