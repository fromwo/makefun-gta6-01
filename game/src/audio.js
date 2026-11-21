// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, siren, gunshot, punch, pickup, mission jingle and a light bass groove.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, musicTimer = 0;
  let enabled = true;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    } catch { return false; }
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  function blip(freq, dur, type, vol, slideTo) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, low) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1800;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const notes = [110, 130.8, 164.8, 196, 220];
  return {
    unlock,
    setEngine(speed01, on) {
      if (!ensure()) return;
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0;
    },
    setSiren(on, time) {
      if (!ensure()) return;
      sirenGain.gain.value = on ? 0.035 : 0;
      if (on) sirenOsc.frequency.value = Math.sin(time * 5) > 0 ? 720 : 540;
    },
    shoot() { noise(0.14, 0.5, 2600); blip(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.35, 900); },
    pickup() { blip(660, 0.12, 'sine', 0.3); blip(990, 0.18, 'sine', 0.3, 990); },
    cash() { blip(880, 0.1, 'sine', 0.3); blip(1174, 0.16, 'sine', 0.3); },
    hurt() { blip(220, 0.2, 'sawtooth', 0.3, 110); },
    sirenBlip() { blip(720, 0.3, 'triangle', 0.2, 540); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sine', 0.32), i * 110)); },
    click() { blip(440, 0.06, 'sine', 0.2); },
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    musicTick(dt) {
      if (!musicOn || !ensure()) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 0.42;
        const n = notes[Math.floor(Math.random() * notes.length)];
        blip(n, 0.35, 'triangle', 0.12);
        if (Math.random() < 0.3) blip(n * 2, 0.2, 'sine', 0.08);
      }
    },
    setEnabled(v) { enabled = v; },
  };
}
