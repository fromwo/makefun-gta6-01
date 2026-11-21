// Solmar Heat — all sound is synthesized with WebAudio. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 60;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineOsc.start();
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) void this.ctx.resume();
    if (this.engineGain) this.engineGain.gain.value = 0;
  }

  engine(speed01) {
    if (!this.ctx || this.muted) return;
    this.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "sine";
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = this.muted ? 0 : 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      this.sirenPhase = 0;
      this.sirenTimer = window.setInterval(() => {
        if (!this.sirenOsc) return;
        this.sirenPhase = 1 - this.sirenPhase;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenPhase ? 880 : 660, this.ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      window.clearInterval(this.sirenTimer);
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  blip(freq, dur, type = "sine", vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  noise(dur, vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  shot() { this.noise(0.14, 0.28); this.blip(180, 0.1, "square", 0.1); }
  enemyShot() { this.noise(0.1, 0.1); }
  punch() { this.noise(0.08, 0.18); }
  crash() { this.noise(0.25, 0.3); this.blip(70, 0.25, "sawtooth", 0.16); }
  horn() { this.blip(330, 0.18, "square", 0.08); this.blip(415, 0.18, "square", 0.08); }
  chime() { this.blip(660, 0.12); window.setTimeout(() => this.blip(880, 0.18), 110); }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bass = [55, 0, 65.4, 0, 49, 0, 73.4, 0, 55, 0, 65.4, 0, 82.4, 73.4, 65.4, 49];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const note = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      if (note) this.blip(note, 0.32, "triangle", 0.05);
      if (this.musicStep % 4 === 0) this.blip(1200, 0.05, "square", 0.015);
    }, 240);
  }
}
