// Career rules: ranks from reputation, what a fitted airframe's numbers are
// once upgrade tiers apply, and which medals a finished sortie earns. Pure
// functions over the save object so the harness verifies progression too.

import { RANKS, UPGRADES } from './data/careerData.js';
import { MEDALS } from './data/medals.js';

export function rankOf(career) {
  let current = RANKS[0];
  for (const r of RANKS) if (career.reputation >= r.rep) current = r;
  return current;
}

export function rankIndex(career) {
  return RANKS.indexOf(rankOf(career));
}

export function upgradeTier(career, airframeId, lineId) {
  return career.upgrades?.[airframeId]?.[lineId] ?? 0;
}

export function upgradeCost(lineId, nextTier) {
  const line = UPGRADES.find((u) => u.id === lineId);
  return line ? line.prices[nextTier - 1] : Infinity;
}

// Apply owned upgrade tiers to a base airframe spec: engine tiers add thrust,
// tank tiers add capacity, gear tiers soften touchdown damage, avionics
// tiers steady the gauges (modelled as a small stall margin).
export function fitAirframe(base, career) {
  const spec = { ...base };
  const t = (line) => upgradeTier(career, base.id, line);
  spec.thrust = base.thrust * (1 + 0.09 * t('engine'));
  spec.fuelCapacity = Math.round(base.fuelCapacity * (1 + 0.14 * t('tank')));
  spec.stallSpeed = base.stallSpeed * (1 - 0.02 * t('avionics'));
  spec.gearTier = t('gear');
  return spec;
}

export function checkMedals(career, sortie) {
  const earned = [];
  for (const medal of MEDALS) {
    if (career.medals.includes(medal.id)) continue;
    if (medal.test(career, sortie)) {
      career.medals.push(medal.id);
      earned.push(medal);
    }
  }
  return earned;
}
