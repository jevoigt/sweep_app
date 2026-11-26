import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { createGameServer } from '../server.mjs';
import { PLAYLIST } from '../public/playlist.js';

test('all five MP3 assets support streaming, HEAD and iOS byte ranges',async t=>{
 const server=createGameServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const track of PLAYLIST){
  const path=base+'/music/'+encodeURIComponent(track.file),{size}=await stat(new URL('../public/music/'+encodeURIComponent(track.file),import.meta.url));
  const head=await fetch(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'audio/mpeg');assert.equal(Number(head.headers.get('content-length')),size);assert.equal(head.headers.get('accept-ranges'),'bytes');
  const range=await fetch(path,{headers:{Range:'bytes=0-1'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,2);assert.equal(range.headers.get('content-range'),`bytes 0-1/${size}`);
  const tail=await fetch(path,{headers:{Range:'bytes=-16'}});assert.equal(tail.status,206);assert.equal((await tail.arrayBuffer()).byteLength,16);
  const invalid=await fetch(path,{headers:{Range:`bytes=${size}-`}});assert.equal(invalid.status,416);
 }
 assert.equal((await fetch(base+'/music/not-a-track.mp3')).status,404);
 assert.equal((await fetch(base+'/music/'+encodeURIComponent('../server.mjs'))).status,404);
 assert.equal((await fetch(base+'/playlist.js')).status,200);
});
