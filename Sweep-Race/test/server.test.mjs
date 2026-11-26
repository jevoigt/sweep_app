import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server.mjs';

test('HTTP eight-player lifecycle: selection, capacity, host start, scores, fresh lobby and stale moves', async t => {
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
  for (const asset of ['/', '/app.js', '/music.js', '/gestures.js', '/style.css', '/field.svg', '/favicon.svg', '/health']) assert.equal((await fetch(base + asset)).status, 200);
  assert.equal((await req('/api/rooms', { name: 'Host', difficulty: 'invalid' })).status, 400);
  const host = await req('/api/rooms', { name: 'Host', difficulty: 'hard' });
  assert.equal(host.status, 201); assert.equal(host.data.state.rows, 30); assert.equal(host.data.state.mines, 99);
  const path = '/api/rooms/' + host.data.state.code, players = [host.data];
  for (let i = 1; i < 8; i++) {
    const guest = await req(path + '/join', { name: `Guest ${i}` });
    assert.equal(guest.status, 201); players.push(guest.data);
  }
  assert.equal((await req(path + '/join', { name: 'Ninth' })).status, 409);
  assert.equal((await req(path)).status, 401);
  const state = await req(path, null, host.data.token);
  assert.equal(state.data.players.length, 8); assert.ok(state.data.board.every(v => v === -2));
  assert.equal(JSON.stringify(state.data).includes(players[1].token), false);
  const action = (p, type, extra = {}) => req(path + '/actions', { type, round: 1, ...extra }, p.token);
  assert.equal((await action(players[1], 'start')).status, 403);
  assert.equal((await action(players[1], 'settings', { difficulty: 'easy' })).status, 403);
  for (const p of players) await action(p, 'ready');
  assert.equal((await req(path, null, host.data.token)).data.phase, 'lobby');
  assert.equal((await action(players[0], 'start')).data.phase, 'countdown');
  for (const p of players.slice(1)) await action(p, 'forfeit');
  const win = await req(path, null, host.data.token);
  assert.equal(win.data.winner, host.data.state.you); assert.equal(win.data.phase, 'finished');
  const replay = await action(players[0], 'lobby');
  assert.equal(replay.data.round, 2); assert.equal(replay.data.phase, 'lobby');
  assert.equal((await action(players[0], 'reveal', { index: 0 })).status, 409);
  assert.equal((await req(path + '/leave', {}, players[7].token)).status, 200);
  assert.equal((await req(path, null, players[7].token)).status, 401);
  assert.equal((await req(path + '/join', { name: 'New guest' })).status, 201);
  const rejected = await fetch(base + path + '/actions', { method: 'POST', headers: { Origin: 'https://unrelated.example', Authorization: `Bearer ${host.data.token}` }, body: '{}' });
  assert.equal(rejected.status, 403);
  assert.equal((await fetch(base + '/api/rooms', { method: 'POST', body: 'null' })).status, 400);
});

test('HTTP daily endpoints expose Medium metadata, private solo state, and end on a mine',async t=>{
 const {datedBoard}=await import('../daily.mjs');const server=createGameServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;
 const meta=await(await fetch(base+'/api/daily')).json();assert.equal(meta.rows,16);assert.equal(meta.columns,16);assert.equal(meta.mines,40);assert.ok(meta.resetAt>meta.serverNow);
 const response=await fetch(base+'/api/daily/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Daily Tester'})});const run=await response.json();assert.equal(response.status,201);assert.equal(run.state.kind,'daily');assert.equal(run.state.players.length,1);assert.ok(run.state.board.every(v=>v===-2));
 const path=base+'/api/rooms/'+run.state.code;
 assert.equal((await fetch(path+'/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Intruder'})})).status,409);
 const mine=datedBoard(run.state.date).indexOf(-1);
 const ended=await(await fetch(path+'/actions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${run.token}`},body:JSON.stringify({type:'reveal',index:mine,round:1})})).json();
 assert.equal(ended.phase,'finished');assert.equal(ended.reason,'mine');assert.equal(ended.opened.length,0);
 for(const asset of ['/effects.js','/daily-results.js'])assert.equal((await fetch(base+asset)).status,200);
 const invalid=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Host',difficulty:'custom',custom:{rows:50,columns:50,mines:2501}})});assert.equal(invalid.status,400);
});
