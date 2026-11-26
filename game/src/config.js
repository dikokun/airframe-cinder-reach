// Tuning constants for the V4 flight game: world scale, flight feel, economy
// and the day/dusk/night lighting moods the low-poly art is graded under.

export const WORLD = {
  size: 11000, // playable square, metres, centred on origin
  seaLevel: 0,
  ceiling: 2600,
};

export const FLIGHT = {
  gravity: 9.81,
  turnRatePerBank: 1.9, // rad/s of heading per radian of bank at 1g
  rollResponse: 3.4,
  pitchResponse: 2.6,
  maxBank: 1.15,
  maxPitch: 0.42,
  groundEffectHeight: 14,
  buffetBand: 3.5, // m/s above stall where the airframe starts to shake
};

export const ECONOMY = {
  startCredits: 2500,
  repairPerPoint: 14, // credits per hull point at the hangar
  fuelPerLitre: 2,
  crashFine: 400,
};

// Lighting moods keyed by the mission's time field. Low-poly flat shading
// lives or dies by these: warm key light, cool fill, tinted fog.
export const TIMES = {
  day: { sky: 0x8ec9e8, fog: 0xbcd9ea, fogNear: 2600, fogFar: 9800, amb: 0.95, sun: 0xfff1d6, sunI: 1.35, fill: 0.3 },
  dusk: { sky: 0xe8a06a, fog: 0xd9a37e, fogNear: 2200, fogFar: 8600, amb: 0.66, sun: 0xffb36b, sunI: 1.0, fill: 0.26 },
  dawn: { sky: 0xa8c4de, fog: 0xc4cfdd, fogNear: 2400, fogFar: 9200, amb: 0.78, sun: 0xffd9a8, sunI: 1.12, fill: 0.28 },
  night: { sky: 0x14263e, fog: 0x1a2c47, fogNear: 1500, fogFar: 6200, amb: 0.55, sun: 0x9db8dd, sunI: 0.5, fill: 0.2 },
};
