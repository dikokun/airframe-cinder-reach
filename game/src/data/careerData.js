// Career structure from the design bible (Parts D-E): five ranks on
// reputation, four upgrade lines at three tiers each. Rank thresholds are
// set against the ladder's own reputation sums, so flying the contracts in
// order always unlocks the next tier of work.

export const GAME_TITLE = 'AIRFRAME — CINDER REACH';

export const RANKS = [
  { name: 'Cadet', rep: 0 },
  { name: 'Line', rep: 8 },
  { name: 'Senior Line', rep: 18 },
  { name: 'Captain', rep: 45 },
  { name: 'Chief', rep: 90 },
];

export const UPGRADES = [
  { id: 'engine', name: 'Powerplant', short: 'PWR', prices: [4500, 14000, 38000] },
  { id: 'gear', name: 'Airframe', short: 'AIR', prices: [3800, 11500, 32000] },
  { id: 'avionics', name: 'Avionics', short: 'AVN', prices: [6200, 15000, 44000] },
  { id: 'tank', name: 'Utility / Aux Tank', short: 'TNK', prices: [4000, 13500, 40000] },
];
