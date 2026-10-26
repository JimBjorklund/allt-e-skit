// Sounds are synthesised with the Web Audio API; nothing is downloaded.
export function createAudio() {
  let ctx = null;
  let osc, osc2, gain, filter;
  let noiseBuf;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    osc = ctx.createOscillator();
    osc2 = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function burst(vol, freq, dur) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  return {
    unlock() {
      try {
        init();
        if (ctx && ctx.state === 'suspended') ctx.resume();
      } catch { /* audio is optional */ }
    },
    // called every frame
    engine({ speed, throttle, running, sputtering }, t) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (!running) {
        gain.gain.setTargetAtTime(0, now, 0.05);
        return;
      }
      const base = 55 + speed * 7 + (throttle ? 12 : 0);
      osc.frequency.setTargetAtTime(base, now, 0.05);
      osc2.frequency.setTargetAtTime(base * 0.5, now, 0.05);
      filter.frequency.setTargetAtTime(350 + speed * 40, now, 0.05);
      let vol = 0.05 + (throttle ? 0.03 : 0);
      if (sputtering) {
        // stuttering dropouts and wobbling pitch warn that a breakdown is coming
        const gate = Math.sin(t * 37) + Math.sin(t * 23.3) > -0.2 ? 1 : 0.05;
        vol *= gate;
        osc.frequency.setTargetAtTime(base * (0.7 + 0.3 * Math.sin(t * 19)), now, 0.02);
      }
      gain.gain.setTargetAtTime(vol, now, 0.02);
    },
    event(e) {
      if (!ctx) return;
      if (e.type === 'breakdown') burst(0.3, 300, 0.4);
      else if (e.type === 'kickFail') burst(0.25, 900, 0.15);
      else if (e.type === 'fixed') burst(0.15, 1500, 0.2);
    },
    kick() {
      burst(0.12, 500, 0.08);
    },
    speak(text) {
      try {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.15;
        u.pitch = 0.8;
        u.volume = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch { /* speech is optional */ }
    },
  };
}
