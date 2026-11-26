import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMusic } from '../public/music.js';
import { PLAYLIST } from '../public/playlist.js';
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture(preference = 'on') {
 const values=new Map([['sweep-music',preference]]);let now=1000,plays=0,pauses=0,fail=false;
 const audio={src:'',currentTime:0,setAttribute(){},play(){plays++;return fail?Promise.reject(new Error('autoplay')):Promise.resolve();},pause(){pauses++;this.onpause?.();}};
 const gain={gain:{value:0},connect(){}};
 const context={state:'suspended',destination:{},createGain:()=>gain,createMediaElementSource:()=>({connect(){}}),resume(){this.state='running';return Promise.resolve();}};
 const tracks=Array.from({length:5},(_,i)=>({file:`${i+1}.mp3`,title:`Track ${i+1}`,duration:10}));
 const music=new GameMusic({tracks,createAudio:()=>audio,createContext:()=>context,now:()=>now,storage:{get:k=>values.get(k),set:(k,v)=>values.set(k,v)}});
 const update=(phase,extra={})=>music.update({phase,visible:true,connected:true,...extra});
 return{music,audio,gain,context,values,update,plays:()=>plays,pauses:()=>pauses,clock:ms=>{now+=ms;},fail:value=>{fail=value;}};
}

test('playlist contains the five supplied tracks in their numbered order',()=>{
 assert.deepEqual(PLAYLIST.map(t=>t.title),['Kokiri Forest','Shop','Market','Kakariko Village','Ocarina of Time']);
 assert.ok(PLAYLIST.every(t=>t.duration>0&&t.file.endsWith('.mp3')));
});

test('home, lobby and countdown never output audible music, including audio priming',async()=>{
 const f=fixture();
 for(const phase of ['home','lobby','countdown']){f.update(phase);f.music.unlock();assert.equal(f.gain.gain.value,0);await settle();assert.equal(f.music.playing,false);assert.equal(f.gain.gain.value,0);}
});

test('gameplay starts the first track automatically after Ready primes the player',async()=>{
 const f=fixture();f.update('lobby',{key:'room:1',elapsedMs:0});f.music.unlock();await settle();
 f.update('playing',{key:'room:1',elapsedMs:0});await settle();
 assert.equal(f.music.playing,true);assert.match(f.audio.src,/1\.mp3$/);assert.equal(f.gain.gain.value,.22);
});

test('ended events advance through all five tracks and loop back to the first',async()=>{
 const f=fixture();f.update('playing',{key:'a',elapsedMs:0});f.music.unlock();await settle();
 for(const expected of [1,2,3,4,0,1]){f.audio.onended();await settle();assert.equal(f.music.index,expected);assert.equal(f.music.playing,true);}
});

test('result, lobby, home, and countdown pause media and immediately silence the output',async()=>{
 for(const phase of ['finished','lobby','home','countdown']){const f=fixture();f.update('playing');f.music.unlock();await settle();f.update(phase);assert.equal(f.music.playing,false);assert.equal(f.gain.gain.value,0);assert.ok(f.pauses()>0);}
});

test('each new game resets the playlist to track one',async()=>{
 const f=fixture();f.update('playing',{key:'room:1',elapsedMs:0});f.music.unlock();await settle();f.audio.onended();await settle();assert.equal(f.music.index,1);
 f.update('countdown',{key:'room:2',elapsedMs:0});f.update('playing',{key:'room:2',elapsedMs:0});await settle();assert.equal(f.music.index,0);assert.equal(f.music.playing,true);
});

test('mute persists; unmuting rejoins the current session position without resetting its order',async()=>{
 const f=fixture();f.update('playing',{key:'room:1',elapsedMs:0});f.music.unlock();await settle();f.music.toggle();assert.equal(f.values.get('sweep-music'),'off');assert.equal(f.gain.gain.value,0);
 f.update('playing',{key:'room:1',elapsedMs:23000});f.music.toggle();await settle();assert.equal(f.music.index,2);assert.equal(f.audio.currentTime,3);assert.equal(f.music.playing,true);
 const muted=fixture('off');muted.music.unlock();assert.equal(muted.music.audio,null);
});

test('hidden/disconnected games are silent; return resumes at the elapsed playlist position',async()=>{
 for(const extra of [{visible:false},{connected:false}]){const f=fixture();f.update('playing',{elapsedMs:0});f.music.unlock();await settle();f.update('playing',extra);assert.equal(f.music.playing,false);assert.equal(f.gain.gain.value,0);f.update('playing',{elapsedMs:44000});await settle();assert.equal(f.music.index,4);assert.equal(f.audio.currentTime,4);}
});

test('autoplay rejection is recoverable with a user tap',async()=>{
 const f=fixture();f.fail(true);f.update('playing');f.music.unlock();await settle();assert.equal(f.music.playing,false);assert.equal(f.music.blocked,true);assert.equal(f.music.unavailable,false);
 const attempts=f.plays();f.update('playing');await settle();assert.equal(f.plays(),attempts);
 f.fail(false);f.music.toggle();await settle();assert.equal(f.music.playing,true);assert.equal(f.music.enabled,true);
});

test('a delayed play promise cannot cause sound after the game has ended',async()=>{
 const f=fixture();let resolve;f.audio.play=()=>new Promise(done=>{resolve=done;});f.update('playing');f.music.unlock();f.update('finished');resolve();await settle();assert.equal(f.music.playing,false);assert.equal(f.gain.gain.value,0);
});

test('unavailable audio cannot break gameplay',()=>{
 const music=new GameMusic({createAudio:()=>{throw new Error('unsupported');}});assert.doesNotThrow(()=>music.unlock());assert.equal(music.unavailable,true);
});

test('muting while a track is loading cancels its eventual playback',async()=>{
 const f=fixture();let resolve;f.audio.play=()=>new Promise(done=>{resolve=done;});f.update('playing');f.music.unlock();assert.equal(f.music.pending,true);f.music.toggle();assert.equal(f.music.enabled,false);resolve();await settle();assert.equal(f.music.playing,false);assert.equal(f.gain.gain.value,0);
});
