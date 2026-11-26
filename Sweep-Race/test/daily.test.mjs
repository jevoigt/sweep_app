import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyDate, dailyReset, datedBoard, createDailyRoom } from '../daily.mjs';
import { act, joinRoom, view } from '../game.mjs';
import { DailyJournal, shareDaily } from '../public/daily-results.js';

for (const date of ['2026-01-15','2026-07-15']) {
  test(`fixed EST reset is exactly 05:00 UTC even on ${date}`, () => {
    const boundary = Date.parse(`${date}T05:00:00Z`);
    assert.notEqual(dailyDate(boundary - 1), date);
    assert.equal(dailyDate(boundary), date);
    assert.equal(dailyReset(boundary - 1), boundary);
    assert.equal(dailyReset(boundary), boundary + 86400000);
  });
}

test('daily layouts are identical for a date, change with the date, and always use Medium', () => {
  assert.deepEqual(datedBoard('2026-11-25'), datedBoard('2026-11-25'));
  assert.notDeepEqual(datedBoard('2026-11-25'), datedBoard('2026-11-26'));
  const room = createDailyRoom('ABC234','Solo',Date.parse('2026-11-25T18:00:00Z'));
  assert.equal(room.rows,16); assert.equal(room.columns,16); assert.equal(room.mines,40);
  assert.equal(room.board.filter(v=>v===-1).length,40);
  assert.ok(view(room,room.players[0]).board.every(v=>v===-2));
  assert.throws(()=>joinRoom(room,'Guest'),/solo/);
});

test('solo flags do not auto-win, and a mine ends the daily immediately', () => {
  const room = createDailyRoom('ABC234','Solo',1000), player=room.players[0];
  act(room,player,{type:'flag',index:0},1100); assert.equal(room.phase,'playing');
  const mine=room.board.findIndex((v,i)=>v===-1&&i!==0);
  act(room,player,{type:'reveal',index:mine},1200);
  assert.equal(room.phase,'finished'); assert.equal(room.reason,'mine'); assert.equal(room.endAt,1200);
});

test('daily clear and voluntary end produce separate outcomes and stable elapsed times', () => {
  for (const clear of [true,false]) {
    const room=createDailyRoom('ABC234','Solo',1000), p=room.players[0];
    if(clear){const last=room.board.findIndex(v=>v>0);p.revealed=new Set(room.board.flatMap((v,i)=>v!==-1&&i!==last?[i]:[]));act(room,p,{type:'reveal',index:last},62000);}
    else act(room,p,{type:'forfeit'},62000);
    assert.equal(room.phase,'finished'); assert.equal(room.reason,clear?'cleared':'abandoned'); assert.equal(room.endAt-room.startAt,61000);
    assert.throws(()=>act(room,p,{type:'reveal',index:1},63000),/not in progress/);
  }
});

test('daily attempt journal survives recreation and updates/resumes never increment attempts', () => {
  const data=new Map(),storage={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};
  let journal=new DailyJournal(storage),room=createDailyRoom('ABC234','Solo',1000),p=room.players[0];
  let state=view(room,p,1000); const first=journal.start(state,p.token); assert.equal(first,1);
  journal.update(state,first);journal=new DailyJournal(storage);assert.equal(journal.read(state.date).attempts,1);
  const second=journal.start(state,p.token);assert.equal(second,2);
  act(room,p,{type:'forfeit'},5000);state=view(room,p,5000);journal.update(state,second);
  assert.equal(journal.read(state.date).runs[second].outcome,'abandoned');
  assert.equal(journal.read('2099-01-01').attempts,0);
  journal.interrupt(state.date,first,6000);assert.equal(journal.read(state.date).runs[first].outcome,'interrupted');
  assert.equal(journal.read(state.date).attempts,2);
});

test('share messages include time on clear, 256-tile denominator on failure, and snark on retries only', () => {
  const run={date:'2026-11-25',attempt:1,outcome:'cleared',startAt:1000,endAt:135000,revealed:216};
  const win=shareDaily(run,1,'https://example.test'); assert.match(win,/02:14/); assert.match(win,/Attempt #1/);assert.doesNotMatch(win,/beneath|rehearsals|relationship/);
  const fail=shareDaily({...run,outcome:'mine',attempt:2,revealed:37},2,'https://example.test');
  assert.match(fail,/37\/256/);assert.match(fail,/2 attempts/);assert.match(fail,/beneath me/);assert.match(fail,/\?daily=1/);
});
