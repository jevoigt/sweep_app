export const HOLD_MS = 450;
export const DRAG_PX = 8;

// Pointer gesture state is separate from rendering and networking so a hold
// cannot also become a reveal, even when Safari synthesizes a click afterward.
export class TileGestures {
  constructor({ onHold, feedback = () => {}, schedule = (fn, ms) => globalThis.setTimeout(fn, ms), clear = id => globalThis.clearTimeout(id), now = () => Date.now() }) {
    this.onHold = onHold; this.feedback = feedback; this.schedule = schedule; this.clear = clear; this.now = now;
    this.active = null; this.blocked = new Map();
  }

  down({ id, x, y, target, primary = true }) {
    if (this.active) { this.cancel(); return; } // Another finger means pinch/pan.
    if (!primary || !target) return;
    for (const [key, until] of this.blocked) if (until < this.now()) this.blocked.delete(key);
    this.blocked.delete(target); // A new intentional gesture is independent.
    const press = { id, x, y, target, held: false, timer: null };
    this.active = press;
    this.feedback(target, true);
    press.timer = this.schedule(() => {
      if (this.active !== press) return;
      press.held = true; press.timer = null;
      this.blocked.set(target, this.now() + 1500);
      this.feedback(target, false);
      this.onHold(target);
    }, HOLD_MS);
  }

  move({ id, x, y }) {
    const press = this.active;
    if (press?.id === id && Math.hypot(x - press.x, y - press.y) > DRAG_PX) this.cancel();
  }

  up(id) {
    const press = this.active;
    if (press?.id !== id) return;
    if (press.held) this.blocked.set(press.target, this.now() + 1500);
    this.finish();
  }

  cancel(id) {
    if (!this.active || (id !== undefined && this.active.id !== id)) return;
    this.blocked.set(this.active.target, this.now() + 1500);
    this.finish();
  }

  finish() {
    const press = this.active;
    if (!press) return;
    if (press.timer !== null) this.clear(press.timer);
    this.feedback(press.target, false);
    this.active = null;
  }

  allowClick(target) {
    const until = this.blocked.get(target);
    if (until !== undefined && until >= this.now()) return false;
    this.blocked.delete(target); return true;
  }

  keyboard(target) { this.blocked.delete(target); }
}
