import test from 'node:test';
import assert from 'node:assert/strict';
import { ElevatorMusic } from '../public/music.js';

function fixture(initialPreference = 'on') {
  const values = new Map([['sweep-music', initialPreference]]), voices = [], timers = new Set();
  let contexts = 0, resumes = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const context = { state: 'suspended', currentTime: 1, destination: {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator() {
      const voice = { frequency: param(), connect() {}, disconnect() {}, start() { this.started = true; }, stop(at) { if (at === undefined) this.cancelled = true; } };
      voices.push(voice); return voice;
    },
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); },
  };
  const music = new ElevatorMusic({ createContext: () => { contexts++; return context; },
    every: fn => { timers.add(fn); return fn; }, cancel: id => timers.delete(id),
    storage: { get: key => values.get(key), set: (key, value) => values.set(key, value) },
  });
  const update = (phase, extra = {}) => music.update({ phase, visible: true, connected: true, ...extra });
  return { music, context, voices, timers, values, update, contexts: () => contexts, resumes: () => resumes };
}

test('home, lobby and countdown are silent even after Ready unlocks audio', () => {
  const f = fixture();
  for (const phase of ['home', 'lobby', 'countdown']) { f.update(phase); f.music.unlock(); assert.equal(f.music.playing, false); }
  assert.equal(f.voices.length, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.contexts(), 1); assert.equal(f.resumes(), 1);
});

test('active gameplay starts exactly one loop after a user gesture', () => {
  const f = fixture(); f.update('playing');
  assert.equal(f.music.playing, false); assert.equal(f.contexts(), 0, 'no automatic context creation');
  f.music.unlock(); assert.equal(f.music.playing, true);
  assert.ok(f.voices.some(v => v.started)); assert.equal(f.timers.size, 1);
  f.update('playing'); f.music.unlock(); assert.equal(f.timers.size, 1);
});

test('returning to lobby or finishing cancels the loop and all scheduled notes', () => {
  for (const phase of ['lobby', 'finished', 'home', 'countdown']) {
    const f = fixture(); f.music.unlock(); f.update('playing');
    assert.ok(f.voices.length > 0);
    f.update(phase);
    assert.equal(f.music.playing, false); assert.equal(f.timers.size, 0);
    assert.ok(f.voices.every(v => v.cancelled));
  }
});

test('mute preference persists and unmuting during play resumes music', () => {
  const f = fixture(); f.music.unlock(); f.update('playing'); f.music.toggle();
  assert.equal(f.music.playing, false); assert.equal(f.values.get('sweep-music'), 'off');
  f.update('lobby'); f.update('playing'); assert.equal(f.music.playing, false);
  f.music.toggle(); assert.equal(f.music.playing, true); assert.equal(f.values.get('sweep-music'), 'on');
  const muted = fixture('off'); muted.music.unlock(); muted.update('playing');
  assert.equal(muted.contexts(), 0); assert.equal(muted.music.playing, false);
});

test('background tabs and disconnected games are silent', () => {
  for (const extra of [{ visible: false }, { connected: false }]) {
    const f = fixture(); f.music.unlock(); f.update('playing');
    f.update('playing', extra); assert.equal(f.music.playing, false); assert.equal(f.timers.size, 0);
    f.update('playing'); assert.equal(f.music.playing, true);
  }
});

test('interrupted audio can be restarted by a tap, without toggling mute', () => {
  const f = fixture(); f.music.unlock(); f.update('playing');
  f.context.state = 'interrupted'; f.context.onstatechange(); assert.equal(f.music.playing, false);
  f.music.toggle(); assert.equal(f.context.state, 'running'); assert.equal(f.music.playing, true); assert.equal(f.music.enabled, true);
});

test('unavailable audio does not break the game', () => {
  const music = new ElevatorMusic({ createContext: () => { throw new Error('not supported'); } });
  assert.doesNotThrow(() => music.unlock()); assert.equal(music.unavailable, true);
  music.update({ phase: 'playing', visible: true, connected: true }); assert.equal(music.playing, false);
});

test('default browser timers keep the global receiver', () => {
  const originalEvery = globalThis.setInterval, originalCancel = globalThis.clearInterval;
  const f = fixture(); let scheduled = 0, cancelled = 0;
  try {
    globalThis.setInterval = function () { assert.equal(this, globalThis); scheduled++; return 123; };
    globalThis.clearInterval = function (id) { assert.equal(this, globalThis); assert.equal(id, 123); cancelled++; };
    const music = new ElevatorMusic({ createContext: () => f.context });
    music.unlock(); music.update({ phase: 'playing', visible: true, connected: true });
    assert.equal(scheduled, 1);
    music.update({ phase: 'lobby', visible: true, connected: true });
    assert.equal(cancelled, 1);
  } finally { globalThis.setInterval = originalEvery; globalThis.clearInterval = originalCancel; }
});
