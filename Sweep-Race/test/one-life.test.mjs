import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,joinRoom,act,view,advance,COUNTDOWN_MS} from '../game.mjs';
import {createDailyRoom} from '../daily.mjs';
function setup(count=1){const room=createRoom('LIFE23','Host',1000);for(let i=1;i<count;i++)joinRoom(room,`Guest ${i}`,1000);const host=room.players[0];act(room,host,{type:'mode',mode:'one-life'},1001);return{room,host};}
function start(room){for(const p of room.players)act(room,p,{type:'ready'},1100);act(room,room.players[0],{type:'start'},1200);advance(room,1200+COUNTDOWN_MS);}
const mines=room=>room.board.flatMap((n,i)=>n===-1?[i]:[]);
test('mode is host-only, validated, lobby-only and resets readiness',()=>{
 const {room,host}=setup(2),guest=room.players[1];
 assert.throws(()=>act(room,guest,{type:'mode',mode:'standard'},1002),/Only the host/);
 assert.throws(()=>act(room,host,{type:'mode',mode:'other'},1002),/Choose Standard/);
 for(const p of room.players)act(room,p,{type:'ready'},1003);
 act(room,host,{type:'mode',mode:'standard'},1004);assert.ok(room.players.every(p=>!p.ready));
 start(room);assert.throws(()=>act(room,host,{type:'mode',mode:'one-life'},5000),/locked/);
});
test('first mine flags pink without scoring; same mine stays protected; second mine loses solo',()=>{
 const {room,host}=setup();start(room);const [a,b]=mines(room);
 act(room,host,{type:'reveal',index:a},5000);assert.equal(room.phase,'playing');assert.equal(host.hit,null);assert.equal(host.savedMine,a);assert.equal(host.revealed.size,0);
 act(room,host,{type:'flag',index:a},5001);act(room,host,{type:'reveal',index:a},5002);assert.ok(host.flags.has(a));assert.equal(host.hit,null);
 const state=view(room,host,5003);assert.equal(state.savedMine,a);assert.equal(state.board[a],-3);
 act(room,host,{type:'reveal',index:b},5004);assert.equal(room.phase,'finished');assert.equal(room.winner,null);assert.equal(room.reason,'mine');
 act(room,host,{type:'lobby'},5005);assert.equal(room.mode,'one-life');assert.equal(host.savedMine,null);assert.equal(host.flags.size,0);
});
test('all twelve players have independent lives and opponent saved coordinates remain private',()=>{
 const {room}=setup(12);start(room);const [a,b]=mines(room);
 for(const p of room.players){act(room,p,{type:'reveal',index:a},5000);assert.equal(p.hit,null);assert.equal(p.savedMine,a);}
 assert.equal(room.phase,'playing');
 act(room,room.players[0],{type:'reveal',index:b},5001);assert.equal(room.phase,'playing');
 const state=view(room,room.players[1],5002);assert.equal(state.players[0].lifeUsed,true);assert.equal(state.players[0].savedMine,undefined);assert.equal(state.board[b],-2);
});
test('chording can spend one life and pauses at that mine; next mine is fatal',()=>{
 const {room,host}=setup();room.rows=3;room.columns=3;room.mines=2;room.safe=7;room.board=[-1,2,-1,1,2,1,0,0,0];start(room);
 host.revealed.add(4);host.flags.add(3);host.flags.add(5);
 act(room,host,{type:'chord',index:4},5000);assert.equal(host.savedMine,0);assert.equal(host.hit,null);assert.equal(room.phase,'playing');
 act(room,host,{type:'reveal',index:2},5001);assert.equal(room.phase,'finished');assert.equal(host.hit,2);
});
test('spending a life still permits a full clear and win',()=>{
 const {room,host}=setup();start(room);act(room,host,{type:'reveal',index:mines(room)[0]},5000);
 for(let i=0;i<room.board.length&&room.phase==='playing';i++)if(room.board[i]!==-1)act(room,host,{type:'reveal',index:i},5001);
 assert.equal(room.winner,host.id);assert.equal(room.reason,'cleared');
});
test('Standard still loses on the first mine, and Daily cannot enable One life',()=>{
 const room=createRoom('STND23','Solo',1000),host=room.players[0];start(room);act(room,host,{type:'reveal',index:mines(room)[0]},5000);assert.equal(room.phase,'finished');assert.equal(host.savedMine,null);
 const daily=createDailyRoom('DAIL23','Solo');assert.throws(()=>act(daily,daily.players[0],{type:'mode',mode:'one-life'}),/not available/);
});
