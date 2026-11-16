// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// Every effect is a short oscillator or filtered-noise envelope; the ambient
// drone is two detuned low oscillators under a slow filter wobble. The context
// is created lazily on the first user gesture (browsers block audio before one),
// and everything is a no-op until then, so headless screenshot runs stay silent.

export function createAudio() {
  let context = null;
  let master = null;
  let droneNodes = null;
  let muted = false;

  /** Build the context on first use; returns false when audio is unavailable. */
  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // A failed blip must never break the game loop.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // See tone(): sound is garnish, never load-bearing.
    }
  }

  return {
    /** Call from a user gesture so the browser lets audio start. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.05, 320);
    },
    hitEnemy() {
      tone(220, 0.05, 'triangle', 0.06, 140);
    },
    enemyDie() {
      noise(0.22, 0.16, 900);
      tone(180, 0.18, 'sawtooth', 0.05, 60);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.09, 1320);
    },
    heal() {
      tone(523, 0.12, 'sine', 0.09, 784);
    },
    playerHit() {
      noise(0.3, 0.22, 500);
      tone(110, 0.3, 'sawtooth', 0.12, 55);
    },
    shieldBlock() {
      tone(1200, 0.12, 'sine', 0.1, 900);
      tone(600, 0.18, 'triangle', 0.06, 900);
    },
    waveStart() {
      tone(392, 0.25, 'triangle', 0.1);
      tone(587, 0.3, 'triangle', 0.08, 587);
    },
    bossRoar() {
      tone(70, 0.7, 'sawtooth', 0.16, 45);
      noise(0.6, 0.12, 300);
    },
    blessing() {
      tone(523, 0.12, 'sine', 0.09);
      tone(659, 0.12, 'sine', 0.09);
      tone(784, 0.2, 'sine', 0.09);
    },
    surge() {
      tone(440, 0.1, 'square', 0.06, 880);
      tone(880, 0.16, 'square', 0.05, 1320);
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.35, 'triangle', 0.1), i * 140);
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.4, 'triangle', 0.09), i * 180);
      });
    },
    /** Start the low ambient drone under the game; safe to call twice. */
    startDrone() {
      if (!ensure() || muted || droneNodes) return;
      try {
        const gain = context.createGain();
        gain.gain.value = 0.035;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 220;
        const oscA = context.createOscillator();
        oscA.type = 'sine';
        oscA.frequency.value = 55;
        const oscB = context.createOscillator();
        oscB.type = 'sine';
        oscB.frequency.value = 82.4;
        const lfo = context.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = context.createGain();
        lfoGain.gain.value = 90;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        oscA.start();
        oscB.start();
        lfo.start();
        droneNodes = { oscA, oscB, lfo, gain };
      } catch {
        droneNodes = null;
      }
    },
    stopDrone() {
      if (!droneNodes) return;
      try {
        droneNodes.oscA.stop();
        droneNodes.oscB.stop();
        droneNodes.lfo.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      droneNodes = null;
    },
  };
}
