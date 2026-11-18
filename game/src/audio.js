// All sound is synthesized with WebAudio: no audio files, no network.
// The context is created lazily on the first user gesture (browsers block
// audio before that) and every call is guarded, so a headless run or a
// muted tab never throws.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let musicStep = 0;
  let nextNoteTime = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* audio is cosmetic */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch { /* audio is cosmetic */ }
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.stopEngine();
      return muted;
    },
    click() { tone(660, 0.07, 'square', 0.1); },
    shoot() { noise(0.12, 0.3, 2400); tone(190, 0.1, 'sawtooth', 0.12, 60); },
    hit() { noise(0.2, 0.25, 900); },
    crash() { noise(0.3, 0.35, 500); tone(90, 0.25, 'triangle', 0.2, 40); },
    pickup() { tone(880, 0.09, 'sine', 0.16); setTimeout(() => tone(1320, 0.12, 'sine', 0.16), 80); },
    steal() { tone(300, 0.12, 'square', 0.12, 520); },
    horn() { tone(370, 0.28, 'sawtooth', 0.14); tone(466, 0.28, 'sawtooth', 0.1); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.18), i * 110));
    },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.14), i * 160)); },
    startEngine() {
      if (!ensure() || muted) return;
      try {
        if (engineOsc) return;
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } catch { /* audio is cosmetic */ }
    },
    setEngine(speed01) {
      if (!engineOsc || !engineGain || muted) return;
      try {
        engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
      } catch { /* audio is cosmetic */ }
    },
    stopEngine() {
      if (!engineOsc) return;
      try { engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null;
      engineGain = null;
    },
    setSiren(on) {
      if (on && !sirenOsc) {
        if (!ensure() || muted) return;
        try {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 700;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenTimer = 0;
        } catch { sirenOsc = null; }
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    updateSiren(dt) {
      if (!sirenOsc) return;
      sirenTimer += dt;
      try {
        const f = Math.sin(sirenTimer * 5.2) > 0 ? 720 : 540;
        sirenOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      } catch { /* audio is cosmetic */ }
    },
  };
}

// A tiny bass-and-hat loop that runs while the game plays. It is kept
// deliberately quiet and simple: a I–VI–III–VII walk in A minor over a
// soft kick, scheduled from the game loop so it never needs its own timer.
export const MUSIC_BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 61.74];
export function musicNoteFor(step) {
  return MUSIC_BASS[step % MUSIC_BASS.length];
}
