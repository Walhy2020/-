const STORAGE_KEY = "flystar-sound-enabled-v1";
const BEAT = 60 / 106;
const STEP = BEAT / 2;
const MELODY = [
  659, 0, 784, 0, 880, 0, 784, 587,
  698, 0, 880, 0, 1047, 0, 880, 784,
  659, 0, 784, 0, 880, 0, 659, 587,
  587, 0, 784, 0, 659, 0, 523, 0,
];
const CHORDS = [
  [261.63, 329.63, 392], [349.23, 440, 523.25],
  [220, 261.63, 329.63], [196, 246.94, 392],
];

export class Soundscape {
  constructor(storage = null, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.storage = storage;
    this.AudioContextClass = AudioContextClass;
    try { this.enabled = storage?.getItem(STORAGE_KEY) !== "false"; }
    catch { this.enabled = true; }
    this.context = null;
    this.timer = null;
    this.stepIndex = 0;
    this.nextNoteAt = 0;
  }

  getState() { return { enabled: this.enabled, active: this.context?.state === "running", supported: Boolean(this.AudioContextClass) }; }

  async unlock() {
    if (!this.enabled || !this.AudioContextClass) return false;
    if (!this.context) {
      const context = new this.AudioContextClass();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(context.destination);
      this.music = context.createGain();
      this.music.gain.value = 0.22;
      this.music.connect(this.master);
      this.effects = context.createGain();
      this.effects.gain.value = 0.65;
      this.effects.connect(this.master);
      this.nextNoteAt = context.currentTime + 0.04;
      this.stepIndex = 0;
    }
    try { await this.context.resume(); }
    catch { return false; }
    if (this.context.state !== "running") return false;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 80);
    this.schedule();
    return true;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    try { this.storage?.setItem(STORAGE_KEY, String(this.enabled)); } catch { /* Sound still works without storage. */ }
    if (!this.enabled) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      const old = this.context;
      this.context = null;
      if (old) void old.close().catch(() => {});
      return Promise.resolve(false);
    }
    return this.unlock();
  }

  toggle() {
    return this.setEnabled(!this.enabled || !this.context);
  }

  voice(frequency, at, duration, volume, type, destination, endFrequency = frequency) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + Math.min(0.035, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  schedule() {
    const context = this.context;
    if (!this.enabled || !context || context.state !== "running") return;
    while (this.nextNoteAt < context.currentTime + 0.24) {
      const index = this.stepIndex % MELODY.length;
      const bar = Math.floor(index / 8);
      const inBar = index % 8;
      if (inBar === 0) {
        for (const frequency of CHORDS[bar]) this.voice(frequency, this.nextNoteAt, BEAT * 3.8, 0.045, "sine", this.music);
        this.voice(CHORDS[bar][0] / 2, this.nextNoteAt, BEAT * 1.35, 0.12, "triangle", this.music);
      }
      if (inBar === 4) this.voice(CHORDS[bar][0] / 2, this.nextNoteAt, BEAT * 0.7, 0.075, "triangle", this.music);
      if (MELODY[index]) this.voice(MELODY[index], this.nextNoteAt, STEP * 1.45, 0.12, "triangle", this.music);
      this.stepIndex++;
      this.nextNoteAt += STEP;
    }
  }

  play(kind) {
    const context = this.context;
    if (!this.enabled || !context || context.state !== "running") return;
    const at = context.currentTime + 0.008;
    if (kind === "glyph") {
      [784, 988, 1175, 1568].forEach((frequency, index) =>
        this.voice(frequency, at + index * 0.07, 0.31, 0.22, "sine", this.effects));
    } else if (kind === "virus") {
      this.voice(420, at, 0.14, 0.19, "triangle", this.effects, 640);
      this.voice(820, at + 0.055, 0.11, 0.09, "sine", this.effects);
    } else if (kind === "growth") {
      [523, 659, 784].forEach((frequency, index) =>
        this.voice(frequency, at + index * 0.08, 0.3, 0.16, "triangle", this.effects));
    } else if (kind === "capture") {
      [523, 659, 784, 1047, 1318].forEach((frequency, index) =>
        this.voice(frequency, at + index * 0.09, 0.45, 0.18, "sine", this.effects));
    } else if (kind === "damage") {
      this.voice(220, at, 0.22, 0.16, "sawtooth", this.effects, 95);
    }
  }
}
