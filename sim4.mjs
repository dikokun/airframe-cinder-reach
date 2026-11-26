// Node harness: flies every contract with the autopilot against the real
// game modules and reports completion, pay, damage and time. This is the
// proof a contract is flyable before it is ever screenshotted or submitted.
//   node sim4.mjs [contractId]

import { AIRFRAMES } from './game/src/data/airframes.js';
import { CONTRACTS } from './game/src/data/contracts.js';
import { fieldById, heightAt } from './game/src/data/zones.js';
import { createPlane, stepPlane, applyDamage } from './game/src/flightModel.js';
import { createSortie, stepSortie } from './game/src/missions.js';
import { createAutopilot, autopilotInput } from './game/src/autopilot.js';
import { createWeather } from './game/src/weather.js';
import { fitAirframe } from './game/src/career.js';

const only = process.argv[2];
const richCareer = {
  credits: 999999, reputation: 99999,
  owned: AIRFRAMES.map((a) => a.id), activeAirframe: AIRFRAMES[0].id,
  upgrades: {}, hull: {}, fuelOnBoard: {}, completed: {}, medals: [],
  stats: { flights: 0, landings: 0, feather: 0, crashes: 0, earned: 0 },
};

let pass = 0, total = 0;
for (const contract of CONTRACTS) {
  if (only && contract.id !== only) continue;
  total++;
  // Fly it in the airframe the contract assigns, as the game does.
  const base = AIRFRAMES.find((a) => a.id === contract.airframe) ?? AIRFRAMES[0];
  richCareer.activeAirframe = base.id;
  const spec = fitAirframe(base, richCareer);
  if (contract.setup?.cargoKg && base.cargoKg) {
    const frac = Math.min(1, contract.setup.cargoKg / base.cargoKg);
    spec.thrust *= 1 - frac * 0.16;
    spec.stallSpeed *= 1 + frac * 0.06;
  }
  const from = fieldById(contract.from);
  const plane = createPlane(spec, {
    x: from.x - Math.sin(from.heading) * from.length * 0.36,
    z: from.z + Math.cos(from.heading) * from.length * 0.36,
    y: heightAt(from.x, from.z),
    heading: from.heading,
    onGround: true,
    fuel: Math.round(spec.fuelCapacity * (contract.setup?.fuelPct ?? 1)),
    damage: 0,
  });
  const weather = createWeather(contract.weather);
  const sortie = createSortie(contract, plane, weather);
  const ap = createAutopilot();
  const dt = 1 / 30;
  let t = 0;
  const maxT = 1500;
  while (t < maxT && sortie.phase === 'work') {
    const input = autopilotInput(ap, plane, sortie, dt);
    const env = { groundY: heightAt(plane.x, plane.z), windX: weather.windX, windZ: weather.windZ, gust: weather.gustAt(t) };
    const events = stepPlane(plane, input, dt, env);
    for (const ev of events) {
      if (ev.type === 'touchdown') {
        const dmg = Math.max(0, ev.severity - 2.4) * (plane.gearDown ? 5 : 9);
        if (dmg > 0) applyDamage(plane, dmg, events, 'touchdown');
      }
    }
    stepSortie(sortie, events, dt);
    t += dt;
  }
  const ok = sortie.phase === 'done' && sortie.pay > 0;
  if (ok) pass++;
  const destF = fieldById(contract.to);
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${contract.id} ${contract.name} — ${sortie.phase}/${sortie.verdict ?? 'timeout'} ` +
    `pay ${sortie.pay} dmg ${Math.round(plane.damage)} fuel ${Math.max(0, Math.round(plane.fuel))}L t ${Math.round(t)}s grade ${sortie.grade?.id ?? '-'} ` +
    `end=(${Math.round(plane.x)},${Math.round(plane.z)}) distDest=${Math.round(Math.hypot(destF.x - plane.x, destF.z - plane.z))} landed=${sortie.landedField?.id ?? 'none'}`,
  );
}
console.log(`== ${pass}/${total} contracts complete ==`);
