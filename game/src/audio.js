// Procedural Web Audio: engine hum tracking throttle, wind over the airframe,
// stall buffet, touchdown thumps, warning beeps and the hangar till. No audio
// files — everything is oscillators and filtered noise, started on first
// interaction so the browser allows it.

export function createAudio() {
  let ctx = null;
  let engineOsc, engineGain, windGain, windFilter;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();

      const noiseLen = ctx.sampleRate * 1.5;
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(ctx.destination);
      noise.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type = 'square', vol = 0.12, when = 0) {
    if (!ensure()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + when);
    o.stop(ctx.currentTime + when + dur + 0.02);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    update(p, dt) {
      if (!ctx) return;
      const rpm = 50 + p.throttle * 85 + p.speed * 0.12;
      engineOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(p.crashed ? 0 : 0.028 + p.throttle * 0.05, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.14, p.speed * 0.0016), ctx.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(300 + p.speed * 9, ctx.currentTime, 0.2);
    },
    stall() { blip(190, 0.16, 'square', 0.1); blip(190, 0.16, 'square', 0.1, 0.22); },
    flameout() { blip(320, 0.5, 'sawtooth', 0.1); blip(210, 0.7, 'sawtooth', 0.09, 0.3); },
    touchdown(good) { blip(good ? 130 : 80, 0.22, 'sine', 0.22); },
    scrape() { blip(70, 0.3, 'sawtooth', 0.16); },
    cash() { blip(880, 0.1, 'sine', 0.12); blip(1320, 0.16, 'sine', 0.12, 0.09); },
    fail() { blip(220, 0.3, 'triangle', 0.14); blip(165, 0.45, 'triangle', 0.14, 0.25); },
    click() { blip(660, 0.05, 'sine', 0.06); },
  };
}
