// Dispatcher radio pools, in the voices the design bible cast (Part D0):
// Mara Vance counts everything, Odell Pike narrates weather like a card
// game, Ines Duarte reads terrain in bearings, Tuli uses callsigns only.

export const RADIO = {
  depart: [
    'Dispatch: say your numbers, not your feelings. You are cleared to roll.',
    'Dispatch: wind is doing what it wants. The strip is yours.',
    'Dispatch: fuel, flaps, and a plan. In that order. Go.',
  ],
  engineout: [
    'Dispatch: engine is gone. Pick your field now, out loud.',
    'Dispatch: glide it. Altitude is money — spend it slowly.',
    'Dispatch: deadstick. The Reach is watching. No pressure.',
  ],
  flameout: [
    'Dispatch: tanks dry. Whatever is below you is the plan now.',
    'Dispatch: flameout. Stretch the glide, mind the stall.',
  ],
  gate: [
    'Dispatch: gate logged. Camera is happy. Next one.',
    'Dispatch: frame captured. Hold the band, keep it boring.',
  ],
  landed: [
    'Dispatch: down and stopped. Numbers received. Good flying.',
    'Dispatch: the Reach keeps working another day. Welcome back.',
  ],
};
