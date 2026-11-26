// Weather presets: each is wind, gust character and a visibility mood the
// terrain fog adopts. Missions name a preset; the model feels the wind, the
// pilot sees the murk.

import { TIMES } from './config.js';

export const WEATHERS = {
  calm: { label: 'Calm', windSpeed: 0, windDir: 0, gustAmp: 0, gustFreq: 0, fogScale: 1 },
  breeze: { label: 'Breeze', windSpeed: 4, windDir: 0.7, gustAmp: 0.5, gustFreq: 0.5, fogScale: 1 },
  crosswind: { label: 'Crosswind', windSpeed: 9, windDir: 1.35, gustAmp: 1.1, gustFreq: 0.8, fogScale: 0.95 },
  storm: { label: 'Storm cell', windSpeed: 13, windDir: -0.6, gustAmp: 2.6, gustFreq: 1.5, fogScale: 0.62 },
  murk: { label: 'Murk', windSpeed: 3, windDir: 2.4, gustAmp: 0.4, gustFreq: 0.4, fogScale: 0.4 },
};

export function createWeather(key) {
  const w = WEATHERS[key] ?? WEATHERS.calm;
  return {
    key,
    label: w.label,
    windX: Math.sin(w.windDir) * w.windSpeed,
    windZ: -Math.cos(w.windDir) * w.windSpeed,
    fogScale: w.fogScale,
    // Vertical gust for this instant: layered sines, deterministic in t.
    gustAt(t) {
      if (w.gustAmp === 0) return 0;
      return (Math.sin(t * w.gustFreq * 2.1) + 0.6 * Math.sin(t * w.gustFreq * 5.7 + 1.7)) * w.gustAmp * 0.5;
    },
    applyFog(scene, timeKey) {
      const mood = TIMES[timeKey] ?? TIMES.day;
      scene.fog.near = mood.fogNear * w.fogScale;
      scene.fog.far = mood.fogFar * w.fogScale;
    },
  };
}
