import { PLAYLIST } from './playlist.js';

export class GameMusic {
  constructor({ tracks = PLAYLIST, createAudio = () => new Audio(), createContext, now = () => Date.now(), onChange = () => {}, storage } = {}) {
    this.tracks = tracks; this.createAudio = createAudio;
    this.createContext = createContext || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    this.now = now; this.onChange = onChange; this.storage = storage;
    this.enabled = storage?.get('sweep-music') !== 'off';
    this.audio = null; this.context = null; this.gain = null;
    this.playing = false; this.pending = false; this.priming = false; this.unlocked = false; this.blocked = false; this.unavailable = false;
    this.phase = 'home'; this.visible = true; this.connected = false;
    this.key = null; this.index = 0; this.elapsedMs = 0; this.sampledAt = this.now(); this.operation = 0;
  }

  get title() { return this.tracks[this.index]?.title || ''; }
  wanted() { return this.enabled && this.phase === 'playing' && this.visible && this.connected; }

  ensure() {
    if (this.audio) return;
    this.audio = this.createAudio(); this.audio.preload = 'metadata'; this.audio.loop = false;
    this.audio.setAttribute?.('playsinline', '');
    this.context = this.createContext();
    this.gain = this.context.createGain(); this.gain.gain.value = 0;
    this.source = this.context.createMediaElementSource(this.audio);
    this.source.connect(this.gain); this.gain.connect(this.context.destination);
    this.select(0);
    this.context.onstatechange = () => this.reconcile();
    this.audio.onended = () => {
      if (!this.wanted()) return this.stop();
      this.playing = false; this.pending = false;
      this.select((this.index + 1) % this.tracks.length);
      this.attempt();
    };
    this.audio.onerror = () => { this.blocked = true; this.stop(); this.onChange(); };
    this.audio.onpause = () => {
      if (!this.playing) return;
      this.playing = false; this.blocked = true; this.gain.gain.value = 0; this.onChange();
    };
    this.audio.onloadedmetadata = () => {
      if (this.seekTarget === null) return;
      try { this.audio.currentTime = this.seekTarget; this.seekTarget = null; } catch {}
    };
  }

  select(index) {
    this.index = index;
    if (!this.audio) return;
    this.audio.src = `/music/${encodeURIComponent(this.tracks[index].file)}`;
    this.seekTarget = 0;
    try { this.audio.currentTime = 0; } catch {}
  }

  align() {
    const duration = this.tracks.reduce((sum, track) => sum + track.duration, 0);
    let seconds = Math.max(0, this.elapsedMs + this.now() - this.sampledAt) / 1000 % duration;
    let index = 0;
    while (index < this.tracks.length - 1 && seconds >= this.tracks[index].duration) seconds -= this.tracks[index++].duration;
    if (this.index !== index) this.select(index);
    this.seekTarget = seconds;
    try { this.audio.currentTime = seconds; } catch {}
  }

  // Call directly from Ready/Start or a tile tap. The media element is routed
  // through a zero-gain Web Audio node until gameplay, including on iOS where
  // the HTMLAudioElement.volume property alone cannot guarantee silence.
  unlock() {
    if (!this.enabled || this.unavailable) return;
    try {
      this.ensure(); this.blocked = false;
      if (this.playing && this.context.state === 'running') return;
      const resumed = this.context.state === 'running' ? Promise.resolve() : this.context.resume();
      Promise.resolve(resumed).then(() => this.reconcile()).catch(() => { this.blocked = true; this.stop(); this.onChange(); });
      if (this.wanted()) this.align();
      this.attempt(); // Stay inside the user gesture for media autoplay permission.
    } catch { this.unavailable = true; this.stop(); this.onChange(); }
  }

  attempt() {
    if (!this.audio || this.pending) return;
    const operation = ++this.operation;
    this.pending = true; this.priming = !this.wanted();
    this.gain.gain.value = this.wanted() && this.context.state === 'running' ? .22 : 0;
    let promise;
    try { promise = this.audio.play(); this.unlocked = true; }
    catch { promise = Promise.reject(new Error('Playback blocked')); }
    Promise.resolve(promise).then(() => {
      if (operation !== this.operation) return;
      this.pending = false; this.priming = false; this.unlocked = true;
      if (this.wanted() && this.context.state === 'running') {
        this.playing = true; this.gain.gain.value = .22;
      } else {
        this.playing = false; this.gain.gain.value = 0; this.audio.pause();
      }
      this.onChange();
    }).catch(() => {
      if (operation !== this.operation) return;
      this.blocked = true; this.stop(); this.onChange();
    });
  }

  update({ phase, visible, connected, key, elapsedMs }) {
    if (key !== undefined && key !== this.key) {
      this.stop(); this.key = key; this.index = 0;
      if (this.audio) this.select(0);
    }
    if (Number.isFinite(elapsedMs)) { this.elapsedMs = elapsedMs; this.sampledAt = this.now(); }
    this.phase = phase; this.visible = visible; this.connected = connected;
    this.reconcile();
  }

  reconcile() {
    if (!this.wanted() || this.context?.state !== 'running') {
      if (this.playing || (this.pending && !this.priming)) this.stop();
    } else if (this.unlocked && !this.blocked && !this.playing && !this.pending) {
      this.align(); this.attempt();
    }
    this.onChange();
  }

  toggle() {
    if (this.enabled && this.phase === 'playing' && !this.playing && !this.pending) return this.unlock();
    this.enabled = !this.enabled; this.storage?.set('sweep-music', this.enabled ? 'on' : 'off');
    if (this.enabled) this.unlock(); else this.stop();
    this.onChange();
  }

  stop() {
    this.operation++; this.pending = false; this.priming = false; this.playing = false;
    if (this.gain) this.gain.gain.value = 0;
    this.audio?.pause();
  }
}
