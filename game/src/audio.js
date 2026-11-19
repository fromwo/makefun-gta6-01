// Solmar Heat — audio.js (r8)
// Every sound is synthesized live with WebAudio: no audio files, no
// network, no downloads. Engine hum, gunfire, sirens, pickup chimes,
// crash thuds and mission jingles are all oscillators and noise.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    let node = src;
    if (lowpass) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g).connect(c.destination);
    src.start();
  }

  function arpeggio(notes, stepMs, dur, type, vol) {
    notes.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * stepMs));
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    blip() {
      tone(660, 0.08, 'sine', 0.1);
    },
    pickup() {
      tone(523, 0.1, 'sine', 0.14);
      setTimeout(() => tone(784, 0.14, 'sine', 0.14), 90);
    },
    cash() {
      tone(880, 0.09, 'triangle', 0.14);
      setTimeout(() => tone(1174, 0.16, 'triangle', 0.14), 80);
    },
    shoot() {
      noise(0.12, 0.28, 1800);
    },
    crash() {
      noise(0.25, 0.3, 500);
      tone(70, 0.2, 'sine', 0.2, 40);
    },
    sirenBlip() {
      tone(950, 0.18, 'sine', 0.07, 650);
    },
    missionStart() {
      arpeggio([392, 523, 659], 110, 0.12, 'triangle', 0.14);
    },
    missionDone() {
      arpeggio([523, 659, 784, 1046], 110, 0.18, 'triangle', 0.15);
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.12, 110);
    },
    engineStart() {
      tone(90, 0.3, 'sawtooth', 0.1, 160);
    },
    setEngine(speed01, on) {
      const c = ensure();
      if (!c) return;
      if (!on) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
        return;
      }
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 70;
        engineGain.gain.value = 0;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        engineOsc.connect(f).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      if (muted) {
        engineGain.gain.setTargetAtTime(0, c.currentTime, 0.05);
        return;
      }
      engineOsc.frequency.setTargetAtTime(60 + speed01 * 160, c.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, c.currentTime, 0.08);
    },
  };
}
