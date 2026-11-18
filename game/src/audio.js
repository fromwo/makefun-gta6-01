// Procedural WebAudio: every sound is synthesized, nothing is loaded, so
// the game stays silent on the network. The context is created lazily on
// the first user gesture (browsers block audio before one); every call
// before that is a safe no-op.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let sirenNodes = null;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  // A lazy bass-and-hat loop in A minor, quiet under the action.
  const BASS_LINE = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 82.41, 0, 73.42, 65.41, 49, 0];
  const STEP_SECONDS = 0.22;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS_LINE[musicStep % BASS_LINE.length];
      musicStep += 1;
      if (note) tone(note, STEP_SECONDS * 0.9, 'triangle', 0.11);
      if (musicStep % 4 === 0) noiseBurst(0.03, 0.05, 6000);
    }, STEP_SECONDS * 1000);
  }

  return {
    /** Call from any user gesture; also starts the music loop. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noiseBurst(0.09, 0.4, 2600);
      tone(190, 0.08, 'square', 0.16, 60);
    },
    enemyShoot() {
      noiseBurst(0.08, 0.22, 1800);
    },
    horn() {
      tone(370, 0.28, 'sawtooth', 0.14);
      tone(466, 0.28, 'sawtooth', 0.12);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.2);
      window.setTimeout(() => tone(880, 0.14, 'sine', 0.2), 90);
    },
    crash() {
      noiseBurst(0.22, 0.5, 500);
      tone(90, 0.2, 'sine', 0.3, 40);
    },
    click() {
      tone(520, 0.05, 'sine', 0.12);
    },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => {
        window.setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110);
      });
    },
    /** A short brass-ish sting when a new mission starts. */
    sting() {
      tone(220, 0.35, 'sawtooth', 0.12, 330);
      tone(277, 0.35, 'sawtooth', 0.1, 415);
    },
    busted() {
      [330, 262, 196].forEach((f, i) => {
        window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.14), i * 160);
      });
    },
    /** Two-tone siren while the player is wanted; quiet, under the music. */
    setSiren(on) {
      if (on && !sirenNodes && ensure() && !muted) {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = 750;
          lfo.type = 'square';
          lfo.frequency.value = 0.9;
          lfoGain.gain.value = 180;
          gain.gain.value = 0.045;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          osc.connect(gain);
          gain.connect(master);
          osc.start();
          lfo.start();
          sirenNodes = { osc, lfo, gain };
        } catch {
          sirenNodes = null;
        }
      } else if (!on && sirenNodes) {
        try {
          sirenNodes.gain.gain.value = 0;
          sirenNodes.osc.stop();
          sirenNodes.lfo.stop();
        } catch {
          // Already stopped.
        }
        sirenNodes = null;
      }
    },
    /** Engine hum that follows the car's speed (0..1). */
    setEngine(level) {
      if (!ensure()) return;
      if (level <= 0.02) {
        if (engineNodes) {
          try { engineNodes.gain.gain.value = 0; engineNodes.osc.stop(); } catch { /* stopped */ }
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = 60;
          gain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start();
          engineNodes = { osc, gain };
        } catch {
          engineNodes = null;
          return;
        }
      }
      try {
        engineNodes.osc.frequency.value = 55 + level * 130;
        engineNodes.gain.gain.value = muted ? 0 : 0.03 + level * 0.05;
      } catch {
        // Engine is decoration.
      }
    },
  };
}
