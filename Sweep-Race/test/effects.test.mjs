import test from 'node:test';
import assert from 'node:assert/strict';
import {ExplosionSound} from '../public/effects.js';
function setup(){
 let starts=0; const data=new Map(),param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},start(){starts++;},stop(){}});
 const context={state:'running',currentTime:0,sampleRate:1000,destination:{},resume(){this.state='running';return Promise.resolve();},
 createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),createBufferSource:()=>node(),createBiquadFilter:()=>({...node(),frequency:param()}),createGain:()=>({...node(),gain:param()}),createOscillator:()=>({...node(),frequency:param()})};
 const effect=new ExplosionSound({storage:{get:k=>data.get(k),set:(k,v)=>data.set(k,v)},createContext:()=>context});
 return{effect,context,data,starts:()=>starts};
}
test('explosion requires unlocked running audio and starts both noise and bass',()=>{const f=setup();assert.equal(f.effect.play(),false);f.effect.unlock();assert.equal(f.effect.play(),true);assert.equal(f.starts(),2);});
test('sound-effect mute is independent and remembered',()=>{const f=setup();f.effect.unlock();f.effect.toggle();assert.equal(f.effect.play(),false);assert.equal(f.data.get('sweep-effects'),'off');f.effect.toggle();assert.equal(f.effect.play(),true);});
test('unsupported audio never interrupts the game',()=>{const effect=new ExplosionSound({createContext:()=>{throw new Error('blocked');}});assert.doesNotThrow(()=>effect.unlock());assert.equal(effect.play(),false);});
