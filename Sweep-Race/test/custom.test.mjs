import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,joinRoom,act,advance,boardSettings,COUNTDOWN_MS} from '../game.mjs';

test('host custom settings allow a 50×50 field with the requested exact mine count',()=>{
 const room=createRoom('ABC234','Host',1000,'custom',{rows:50,columns:50,mines:2499});
 assert.equal(room.board.length,2500);assert.equal(room.board.filter(v=>v===-1).length,2499);assert.equal(room.safe,1);
 const guest=joinRoom(room,'Guest',1000);
 assert.throws(()=>act(room,guest,{type:'settings',difficulty:'custom',custom:{rows:2,columns:2,mines:1}},1100),/Only the host/);
});

test('invalid custom dimensions and excess mines are rejected before board allocation',()=>{
 for(const custom of [{rows:51,columns:50,mines:1},{rows:50,columns:51,mines:1},{rows:0,columns:1,mines:0},{rows:2.5,columns:2,mines:1},{rows:2,columns:2,mines:5},{rows:2,columns:2,mines:-1},{rows:2,columns:2,mines:1.2},{rows:'2',columns:2,mines:1}])assert.throws(()=>boardSettings('custom',custom),/Custom rows/);
});

test('equal mines and tiles is allowed and does not award an automatic clear',()=>{
 const room=createRoom('ABC234','Host',1000,'custom',{rows:1,columns:1,mines:1});const [a]=room.players,b=joinRoom(room,'Guest',1000);
 act(room,a,{type:'ready'},1100);act(room,b,{type:'ready'},1100);act(room,a,{type:'start'},1200);advance(room,1200+COUNTDOWN_MS);
 act(room,a,{type:'reveal',index:0},5000);assert.equal(room.phase,'playing');
 act(room,b,{type:'reveal',index:0},5100);assert.equal(room.phase,'finished');assert.equal(room.winner,null);
});

test('zero mines is allowed; one reveal naturally clears the field',()=>{
 const room=createRoom('ABC234','Host',1000,'custom',{rows:2,columns:3,mines:0});const a=room.players[0];joinRoom(room,'Guest',1000);room.phase='playing';room.startAt=1000;
 act(room,a,{type:'reveal',index:0},1200);assert.equal(room.phase,'finished');assert.equal(room.winner,a.id);assert.equal(a.revealed.size,6);
});

test('custom dimensions persist when the host opens the next lobby',()=>{
 const room=createRoom('ABC234','Host',1000,'custom',{rows:4,columns:7,mines:12});const a=room.players[0],b=joinRoom(room,'Guest',1000);room.phase='playing';room.startAt=1000;
 act(room,b,{type:'forfeit'},1200);act(room,a,{type:'lobby'},1300);
 assert.equal(room.rows,4);assert.equal(room.columns,7);assert.equal(room.mines,12);assert.equal(room.difficulty,'custom');
});
