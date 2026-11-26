// Sortie state machine: one flight of a contract, from spawn to the pay
// slip. Contracts are data (data/contracts.js, written from the design
// bible); this module interprets them — route tasks, en-route emergencies,
// waypoint work, touchdown grading and the verdict the career banks.

import { AIRFIELDS, fieldById, heightAt } from './data/zones.js';
import { clamp } from './random.js';

export const GRADES = [
  { id: 'feather', label: 'FEATHER', maxSink: 1.6, mult: 1.25 },
  { id: 'smooth', label: 'SMOOTH', maxSink: 3.0, mult: 1.1 },
  { id: 'firm', label: 'FIRM', maxSink: 5.0, mult: 1.0 },
  { id: 'heavy', label: 'HEAVY', maxSink: 7.5, mult: 0.8 },
  { id: 'hard', label: 'HARD', maxSink: Infinity, mult: 0.55 },
];

export function gradeOf(sink) {
  return GRADES.find((g) => sink <= g.maxSink) ?? GRADES[GRADES.length - 1];
}

export function createSortie(contract, plane, weather) {
  const from = fieldById(contract.from);
  const to = fieldById(contract.to);
  const sortie = {
    contract,
    plane,
    weather,
    fromField: from,
    toField: to,
    phase: 'work', // work -> landed -> done | failed
    t: 0,
    gates: [],
    gateIdx: 0,
    engineCutAt: contract.setup?.engineOutAt ?? null, // seconds after liftoff
    engineCutDone: false,
    liftoffAt: null,
    landedField: null,
    grade: null,
    touchdownSink: 0,
    verdict: null,
    pay: 0,
    messages: [],
    lowFuel: false,
  };

  // Survey contracts get a ring of gates around the destination to fly
  // through inside an altitude band before landing.
  if (contract.type === 'survey') {
    const n = contract.setup?.gates ?? 4;
    // A survey grid is flown at ONE altitude: the highest ground on the
    // ring plus the survey height. Per-gate altitudes over broken ground
    // demand climbs no aeroplane on the roster can make between gates.
    const ring = [];
    let top = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.5;
      const gx = to.x + Math.cos(a) * 620;
      const gz = to.z + Math.sin(a) * 620;
      ring.push({ x: gx, z: gz });
      top = Math.max(top, heightAt(gx, gz));
    }
    const gy = top + (contract.setup?.gateAlt ?? 150);
    for (const g of ring) sortie.gates.push({ x: g.x, z: g.z, y: gy, done: false });
  }
  return sortie;
}

export function sortieTarget(sortie) {
  if (sortie.contract.type === 'survey' && sortie.gateIdx < sortie.gates.length) {
    const g = sortie.gates[sortie.gateIdx];
    return { x: g.x, z: g.z, y: g.y, kind: 'gate' };
  }
  const to = fieldById(sortie.contract.to);
  return { x: to.x, z: to.z, y: heightAt(to.x, to.z), kind: 'field' };
}

export function stepSortie(sortie, events, dt) {
  const p = sortie.plane;
  const c = sortie.contract;
  sortie.t += dt;
  sortie.lowFuel = p.fuel < p.spec.fuelCapacity * 0.15;

  for (const ev of events) {
    if (ev.type === 'liftoff' && sortie.liftoffAt === null) sortie.liftoffAt = sortie.t;
    if (ev.type === 'flameout') sortie.messages.push('flameout');
    if (ev.type === 'crash') {
      sortie.phase = 'failed';
      sortie.verdict = 'CRASHED';
      sortie.pay = 0;
    }
    if (ev.type === 'touchdown') {
      sortie.touchdownSink = ev.sink;
      sortie.grade = gradeOf(ev.severity);
      // Touching down on any strip ends the flying; which strip decides pay.
      const field = AIRFIELDS.find((f) => Math.hypot(f.x - p.x, f.z - p.z) < Math.max(f.length * 0.62, 240));
      sortie.landedField = field ?? null;
    }
  }
  if (sortie.phase !== 'work') return sortie;

  // En-route emergency: the engine quits at the scripted moment.
  if (sortie.engineCutAt !== null && !sortie.engineCutDone && sortie.liftoffAt !== null && sortie.t - sortie.liftoffAt >= sortie.engineCutAt) {
    sortie.engineCutDone = true;
    p.engineOut = true;
    sortie.messages.push('engineout');
  }

  // Survey gates: pass close, inside the band.
  if (c.type === 'survey' && sortie.gateIdx < sortie.gates.length) {
    const g = sortie.gates[sortie.gateIdx];
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    if (d < 200 && Math.abs(p.y - g.y) < (sortie.contract.setup?.gateBand ?? 150)) {
      g.done = true;
      sortie.gateIdx++;
      sortie.messages.push('gate');
    }
  }

  // Completion: stopped on the ground after a touchdown.
  if (p.onGround && p.stopped && sortie.grade) {
    const dest = fieldById(c.to);
    const atDest = sortie.landedField && sortie.landedField.id === dest.id;
    const gatesDone = c.type !== 'survey' || sortie.gateIdx >= sortie.gates.length;
    if (atDest && gatesDone) {
      sortie.phase = 'done';
      sortie.verdict = 'COMPLETE';
      const damagePenalty = clamp(1 - p.damage * 0.006, 0.4, 1);
      sortie.pay = Math.round(c.pay * sortie.grade.mult * damagePenalty);
    } else if (sortie.landedField) {
      // A safe landing at the wrong strip still banks partial credit on
      // emergency contracts — the plane and the story survive.
      sortie.phase = 'done';
      sortie.verdict = c.type === 'engineout' || c.type === 'diversion' ? 'DIVERTED — SAFE' : 'WRONG FIELD';
      sortie.pay = sortie.verdict.startsWith('DIVERTED') ? Math.round(c.pay * 0.45) : 0;
    } else {
      sortie.phase = 'failed';
      sortie.verdict = 'PUT DOWN OFF-FIELD';
      sortie.pay = 0;
    }
  }
  return sortie;
}

export function clockText(sortie, t) {
  const s = Math.floor(t);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
