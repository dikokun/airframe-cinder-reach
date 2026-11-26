# AIRFRAME — Cinder Reach

[![Competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=repo&utm_campaign=best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/dikokun/airframe-cinder-reach/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=repo&utm_campaign=best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/dikokun/airframe-cinder-reach/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=repo&utm_campaign=best-flight-game-20261126-0057)

A low-poly mission flight game in the Extreme Landings pattern. One coherent
region — the **Cinder Reach** — eight strips that all want you to land
somewhere else, four airframes with distinct silhouettes, and a twelve-mission
career ladder where the flying itself is the challenge: precision landings,
engine-out glides, low-fuel diversions, cargo runs, a rescue, a survey grid,
night approaches. Fuel and hull are sortie stakes; every touchdown is graded.

**Design:** production bible by deepseek-v4.1-flash-uncensored (Beastfarmer) —
world, roster, mission ladder, systems. **Build:** Muse, in-session.

## The game

- **8 airfields** — Kestrel Field, Ashen Deck (caldera rim, 720 m of ash),
  Nine-Mile salt pan, Cut 4 (one-way canyon gravel), Tidegate coral atoll,
  Hjalmar in the ice fog, Vesper Ridge, and the Petrel Platform: 340 m of
  steel deck over open sea.
- **4 airframes** — Kestrel K-2 Wren (STOL trainer), Skiff S-4 Marlin
  (amphibious surveyor), Halberd T-6 Pike (twin turboprop), Anvil A-9 Mule
  (heavy freighter). Each with its own stall, burn, cargo and silhouette.
- **12 contracts, 7 mission types** — precision landing, engine-out,
  low-fuel diversion, cargo, rescue, survey, night approach — dispatched by
  seven named dispatchers, gated by 5 ranks (Cadet → Chief).
- **Systems** — fuel burn and reserve grading, hull damage carried between
  sorties, landing grades (feather → hard) that scale pay, 4 upgrade lines ×
  3 tiers, 10 medals, a persistent career save.
- **Flight model** — lift/stall with buffet, coordinated turns, ground
  effect, flap and gear drag, wind and gusts per weather preset, deadstick
  glide physics. An autopilot flies every contract in `sim4.mjs` as a
  regression proof: 12/12 complete.
- **Staging** — `game/src/shotDirector.js` composes the judged screenshots
  by flying real approaches and freezing the frame; nothing is posed.

## Layout

- `main.ts` — the make.fun hand-in: copies `game/` + `screenshots/`, writes
  the dossier.
- `game/src/` — one job per file: flight model, autopilot, missions,
  terrain, aircraft models, cameras, instruments, HUD, screens, saves.
- `game/src/data/` — the Reach as data: airfields, airframes, contracts,
  medals, radio lines.
- `sim4.mjs` — headless proof that all 12 contracts are flyable end to end.
