// Sounds are synthesised with the Web Audio API; nothing is downloaded.
export function createAudio() {
  let ctx = null;
  let osc, osc2, gain, filter;
  let noiseBuf;
  let windGain;
  let nextBird = 0;

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
    // looping wind, louder with speed
    const wb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const wd = wb.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < wd.length; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.2; wd[i] = lp; }
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = wb; wsrc.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 700; wf.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.01;
    wsrc.connect(wf).connect(windGain).connect(ctx.destination);
    wsrc.start();
  }

  function chirp(t0, f0, f1, dur, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
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
      windGain.gain.setTargetAtTime(0.008 + speed * 0.0045, now, 0.2);
      if (now > nextBird) {
        nextBird = now + 2 + Math.random() * 6;
        const base = 2400 + Math.random() * 1600;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) chirp(now + i * 0.13, base, base * (1.2 + Math.random() * 0.4), 0.09, 0.018);
      }
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
      else if (e.type === 'bump') burst(Math.min(0.5, 0.1 + e.impact * 0.03), 140, 0.3);
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
