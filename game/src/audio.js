// Procedural WebAudio for Solmar Heat: no audio files, everything is synthesized.
// Engine hum, two-tone SCPD siren, gunshots, pickup chimes, mission jingles and a
// lazy coastal bassline. All sound is created on first user input (browser rule).
export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, muted: false, musicTimer: 0, musicStep: 0,
    ensure() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.master.gain.value = A.muted ? 0 : 0.5;
        A.master.connect(A.ctx.destination);
        A.startEngine();
        A.startSiren();
      } catch (e) { A.ctx = null; return false; }
      return true;
    },
    setMuted(m) {
      A.muted = m;
      if (A.master) A.master.gain.value = m ? 0 : 0.5;
    },
    startEngine() {
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 320;
      A.engineOsc.connect(filt); filt.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
    },
    setEngine(speedFrac, driving) {
      if (!A.engineOsc) return;
      const t = A.ctx.currentTime;
      A.engineOsc.frequency.setTargetAtTime(50 + speedFrac * 160, t, 0.08);
      A.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedFrac * 0.06 : 0, t, 0.1);
    },
    startSiren() {
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'square';
      A.sirenOsc.frequency.value = 660;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      setInterval(() => {
        if (!A.sirenOsc || !A.ctx) return;
        A.sirenOsc.frequency.value = A.sirenOsc.frequency.value > 700 ? 520 : 880;
      }, 420);
    },
    setSiren(on) {
      if (!A.sirenGain) return;
      A.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, A.ctx.currentTime, 0.15);
    },
    blip(freq, dur, type, vol, slideTo) {
      if (!A.ctx) return;
      const t = A.ctx.currentTime;
      const o = A.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(A.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, low) {
      if (!A.ctx) return;
      const t = A.ctx.currentTime;
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = low || 2400;
      const g = A.ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(filt); filt.connect(g); g.connect(A.master);
      src.start(t);
    },
    shoot() { A.noise(0.12, 0.3, 3200); A.blip(180, 0.08, 'square', 0.12, 60); },
    honk() { A.blip(370, 0.22, 'square', 0.12); A.blip(466, 0.22, 'square', 0.1); },
    pickup() { A.blip(880, 0.1, 'sine', 0.16); setTimeout(() => A.blip(1320, 0.14, 'sine', 0.16), 70); },
    hurt() { A.blip(140, 0.2, 'sawtooth', 0.16, 70); },
    busted() { A.blip(520, 0.3, 'square', 0.14, 260); setTimeout(() => A.blip(390, 0.4, 'square', 0.14, 200), 220); },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => A.blip(n, 0.22, 'triangle', 0.18), i * 110));
    },
    // A slow coastal groove: Am – F – C – G roots with a soft fifth on top.
    musicTick(dt) {
      if (!A.ctx || A.muted) return;
      A.musicTimer += dt;
      if (A.musicTimer < 0.42) return;
      A.musicTimer = 0;
      const roots = [110, 87.31, 130.81, 98];
      const root = roots[Math.floor(A.musicStep / 4) % 4];
      const fifth = root * 1.5;
      A.blip(root, 0.4, 'triangle', 0.07);
      if (A.musicStep % 2 === 0) A.blip(fifth, 0.3, 'sine', 0.045);
      if (A.musicStep % 8 === 6) A.blip(root * 2, 0.18, 'sine', 0.05);
      A.musicStep++;
    },
    crash() { A.noise(0.35, 0.3, 900); A.blip(90, 0.3, 'sawtooth', 0.14, 40); },
  };
  return A;
}
