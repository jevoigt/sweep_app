import test from 'node:test';
import assert from 'node:assert/strict';
import { TileGestures, HOLD_MS, DRAG_PX } from '../public/gestures.js';

function fixture() {
  let now = 0, serial = 0;
  const jobs = new Map(), holds = [], feedback = [], target = {};
  const gestures = new TileGestures({ onHold: tile => holds.push(tile), feedback: (...args) => feedback.push(args), now: () => now,
    schedule: (fn, ms) => { const id = ++serial; jobs.set(id, { fn, at: now + ms }); return id; }, clear: id => jobs.delete(id) });
  function advance(ms) {
    now += ms;
    for (const [id, job] of jobs) if (job.at <= now) { jobs.delete(id); job.fn(); }
  }
  const down = (extra = {}) => gestures.down({ id: 1, x: 10, y: 10, target, primary: true, ...extra });
  return { gestures, target, jobs, holds, feedback, advance, down };
}

test('a short tap permits one normal click and never flags', () => {
  const f = fixture(); f.down(); f.advance(HOLD_MS - 1); f.gestures.up(1); f.advance(1000);
  assert.equal(f.holds.length, 0); assert.equal(f.jobs.size, 0); assert.equal(f.gestures.allowClick(f.target), true);
});

test('a stationary hold flags once and suppresses the release click', () => {
  const f = fixture(); f.down(); f.advance(HOLD_MS); f.advance(4000);
  assert.deepEqual(f.holds, [f.target]);
  f.gestures.up(1); assert.equal(f.gestures.allowClick(f.target), false);
  assert.equal(f.gestures.allowClick(f.target), false, 'late synthetic clicks are also ignored');
  assert.equal(f.feedback.at(-1)[1], false);
});

test('a new intentional tap after a hold is allowed immediately', () => {
  const f = fixture(); f.down(); f.advance(HOLD_MS); f.gestures.up(1);
  assert.equal(f.gestures.allowClick(f.target), false);
  f.down(); f.gestures.up(1); assert.equal(f.gestures.allowClick(f.target), true);
});

test('another hold invokes flag again, allowing a flagged tile to be unflagged', () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) { f.down(); f.advance(HOLD_MS); f.gestures.up(1); }
  assert.equal(f.holds.length, 2);
});

test('dragging more than the movement threshold prevents flagging and clicking', () => {
  const f = fixture(); f.down(); f.gestures.move({ id: 1, x: 10 + DRAG_PX + 1, y: 10 }); f.advance(1000); f.gestures.up(1);
  assert.equal(f.holds.length, 0); assert.equal(f.gestures.allowClick(f.target), false); assert.equal(f.jobs.size, 0);
});

test('a slight finger tremor does not cancel a hold', () => {
  const f = fixture(); f.down(); f.gestures.move({ id: 1, x: 12, y: 11 }); f.advance(HOLD_MS);
  assert.equal(f.holds.length, 1);
});

test('pointer cancellation and scroll/background cancellation suppress any move', () => {
  for (const cancel of [f => f.gestures.cancel(1), f => f.gestures.cancel()]) {
    const f = fixture(); f.down(); cancel(f); f.advance(1000);
    assert.equal(f.holds.length, 0); assert.equal(f.gestures.allowClick(f.target), false);
  }
});

test('a second pointer cancels the first hold instead of flagging during a pinch', () => {
  const f = fixture(); f.down(); f.down({ id: 2, primary: false }); f.advance(1000);
  assert.equal(f.holds.length, 0); assert.equal(f.gestures.allowClick(f.target), false);
  assert.equal(f.gestures.active, null);
});

test('unrelated pointer moves/releases do not disturb an active hold', () => {
  const f = fixture(); f.down(); f.gestures.move({ id: 2, x: 100, y: 100 }); f.gestures.up(2); f.gestures.cancel(2); f.advance(HOLD_MS);
  assert.equal(f.holds.length, 1);
});

test('keyboard activation can reveal immediately after a pointer hold', () => {
  const f = fixture(); f.down(); f.advance(HOLD_MS); f.gestures.up(1);
  f.gestures.keyboard(f.target); assert.equal(f.gestures.allowClick(f.target), true);
});
