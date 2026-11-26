export class ExplosionSound {
  constructor({ storage, createContext } = {}) {
    this.storage = storage; this.enabled = storage?.get('sweep-effects') !== 'off';
    this.createContext = createContext || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    this.context = null;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= this.createContext();
      if (this.context.state !== 'running') Promise.resolve(this.context.resume()).catch(() => {});
    } catch {} // Audio must never block a move on unsupported browsers.
  }
  toggle() {
    this.enabled = !this.enabled; this.storage?.set('sweep-effects', this.enabled ? 'on' : 'off');
    if (this.enabled) this.unlock();
  }
  play() {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return false;
    try {
      const now = context.currentTime, duration = .65;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
      const noise = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      noise.buffer = buffer; filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, now); filter.frequency.exponentialRampToValueAtTime(180, now + duration);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.32, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      noise.connect(filter); filter.connect(gain); gain.connect(context.destination);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
      noise.start(now); noise.stop(now + duration);
      const bass = context.createOscillator(), bassGain = context.createGain();
      bass.type = 'sine'; bass.frequency.setValueAtTime(135, now); bass.frequency.exponentialRampToValueAtTime(38, now + .42);
      bassGain.gain.setValueAtTime(.0001, now); bassGain.gain.exponentialRampToValueAtTime(.28, now + .012); bassGain.gain.exponentialRampToValueAtTime(.0001, now + .5);
      bass.connect(bassGain); bassGain.connect(context.destination);
      bass.onended = () => { bass.disconnect(); bassGain.disconnect(); };
      bass.start(now); bass.stop(now + .52);
      return true;
    } catch { return false; }
  }
}
