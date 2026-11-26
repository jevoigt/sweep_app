// Original, synthesized lounge music. No audio downloads or third-party tracks.
const BARS = [
  { chord: [60, 64, 67, 71], bass: 36, melody: [76, null, 79, 81, null, 79, 76, 74] },
  { chord: [57, 60, 64, 67], bass: 33, melody: [72, 76, null, 79, 76, 74, null, 72] },
  { chord: [60, 64, 65, 69], bass: 38, melody: [77, null, 76, 74, null, 72, 69, 72] },
  { chord: [59, 62, 65, 69], bass: 31, melody: [74, 77, null, 76, 74, null, 71, 69] },
  { chord: [59, 62, 64, 67], bass: 40, melody: [76, null, 79, 83, 81, 79, null, 76] },
  { chord: [61, 64, 67, 71], bass: 33, melody: [73, 76, null, 79, 76, 73, null, 71] },
  { chord: [60, 64, 65, 69], bass: 38, melody: [74, null, 77, 76, 74, 72, null, 69] },
  { chord: [59, 62, 65, 69], bass: 31, melody: [71, 74, null, 77, 76, 74, 71, null] },
];
const BEAT = 60 / 88;

export class ElevatorMusic {
  constructor({ createContext, every = (fn, ms) => globalThis.setInterval(fn, ms), cancel = id => globalThis.clearInterval(id), onChange = () => {}, storage } = {}) {
    this.createContext = createContext || (() => {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      return new Audio();
    });
    this.every = every; this.cancel = cancel; this.onChange = onChange; this.storage = storage;
    this.enabled = storage?.get('sweep-music') !== 'off';
    this.context = null; this.master = null; this.voices = new Set(); this.timer = null;
    this.playing = false; this.unavailable = false; this.phase = 'home'; this.visible = true; this.connected = false;
    this.step = 0; this.nextAt = 0;
  }

  // Call directly from a tap/click, before awaiting a network request. Resuming
  // the context unlocks audio but schedules no sound in the lobby/countdown.
  unlock() {
    if (!this.enabled || this.unavailable) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.master.gain.value = .22;
        this.master.connect(this.context.destination);
        this.context.onstatechange = () => this.reconcile();
      }
      const resumed = this.context.state === 'running' ? Promise.resolve() : this.context.resume();
      Promise.resolve(resumed).then(() => this.reconcile()).catch(() => { this.stop(); this.onChange(); });
      this.reconcile();
    } catch { this.unavailable = true; this.stop(); this.onChange(); }
  }

  update({ phase, visible, connected }) {
    this.phase = phase; this.visible = visible; this.connected = connected;
    this.reconcile();
  }

  toggle() {
    // If the browser blocked audio, a tap retries playback instead of muting.
    if (this.enabled && this.phase === 'playing' && this.context?.state !== 'running') return this.unlock();
    this.enabled = !this.enabled;
    this.storage?.set('sweep-music', this.enabled ? 'on' : 'off');
    if (this.enabled) this.unlock();
    this.reconcile();
  }

  reconcile() {
    const wanted = this.enabled && this.phase === 'playing' && this.visible && this.connected && this.context?.state === 'running';
    if (wanted && !this.playing) {
      this.playing = true; this.step = 0; this.nextAt = this.context.currentTime + .04;
      this.schedule();
      this.timer = this.every(() => this.schedule(), 80);
    } else if (!wanted && this.playing) this.stop();
    this.onChange();
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    // Cancel already scheduled notes as well as the loop. No tail in a lobby.
    for (const source of this.voices) { try { source.stop(); } catch {} }
    this.voices.clear();
  }

  tone(midi, when, duration, volume, type = 'sine') {
    const source = this.context.createOscillator(), envelope = this.context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), when);
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + .016);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(envelope); envelope.connect(this.master);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(when); source.stop(when + duration + .02);
  }

  schedule() {
    if (!this.playing || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (this.nextAt < now) this.nextAt = now + .04; // Don’t catch up missed notes after a stall.
    while (this.nextAt < now + .2) {
      const bar = BARS[Math.floor(this.step / 8) % BARS.length], eighth = this.step % 8, at = this.nextAt;
      if ([0, 3, 6].includes(eighth)) {
        for (const note of bar.chord) {
          this.tone(note, at, BEAT * 1.5, .075);
          this.tone(note + 12, at, BEAT * .65, .012);
        }
      }
      if (eighth === 0 || eighth === 4) this.tone(bar.bass + (eighth === 4 ? 7 : 0), at, BEAT * 1.65, .15, 'triangle');
      if (bar.melody[eighth] !== null) {
        this.tone(bar.melody[eighth], at, BEAT * 1.1, .105);
        this.tone(bar.melody[eighth] + 12, at, BEAT * .4, .012);
      }
      this.nextAt += BEAT * (eighth % 2 ? .4 : .6);
      this.step = (this.step + 1) % (BARS.length * 8);
    }
  }
}
