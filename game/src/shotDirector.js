// Staged screenshots: each shot starts a real sortie in a composed state and
// lets the autopilot fly it; when the composed moment arrives the sim
// freezes and the browser renders that frame. Headless capture coalesces
// animation frames, so while a director is active the conductor warps —
// many fixed steps per frame — until the freeze. Nothing is posed by hand:
// the altimeter, the damage, the clock in frame are the sim's own.

import { fieldById, heightAt } from './data/zones.js';
import { CONTRACTS } from './data/contracts.js';

export const SHOT_WARP_STEPS = 45;

const SHOTS = {
  // On final: gear down, flaps full, runway filling the windscreen.
  approach: {
    contract: 'd02-salt-in-the-seams',
    camera: 'chase',
    spawn(p, from, to) {
      const back = 620;
      p.x = to.x - Math.sin(to.heading) * back;
      p.z = to.z + Math.cos(to.heading) * back;
      p.y = heightAt(to.x, to.z) + 62;
      p.heading = to.heading;
      p.speed = 34; p.onGround = false; p.gearDown = true; p.flaps = 2;
    },
    freeze(sortie, p) {
      const to = sortie.toField;
      return Math.hypot(to.x - p.x, to.z - p.z) < 400;
    },
  },
  // Cockpit on a crosswind arrival: panel lit, strip ahead through glass.
  cockpit: {
    contract: 'd03-twenty-two-on-the-nose',
    camera: 'cockpit',
    spawn(p, from, to) {
      const back = 800;
      p.x = to.x - Math.sin(to.heading) * back + 130;
      p.z = to.z + Math.cos(to.heading) * back;
      p.y = heightAt(to.x, to.z) + 78;
      p.heading = to.heading;
      p.speed = 36; p.onGround = false; p.gearDown = true; p.flaps = 1;
    },
    freeze(sortie, p) {
      const to = sortie.toField;
      return Math.hypot(to.x - p.x, to.z - p.z) < 620;
    },
  },
  // Engine out over the coast: dead prop, glide slope, the strip or nothing.
  emergency: {
    contract: 'd05-the-long-quiet',
    camera: 'chase',
    spawn(p, from, to) {
      p.x = (from.x + to.x) / 2 + 500;
      p.z = (from.z + to.z) / 2 - 300;
      p.y = heightAt(p.x, p.z) + 420;
      p.heading = Math.atan2(to.x - p.x, -(to.z - p.z));
      p.speed = 41; p.onGround = false; p.engineOut = true; p.gearDown = false;
    },
    freeze(sortie, p, t) {
      return t > 6;
    },
  },
};

export function shotConfig(name) {
  return SHOTS[name] ?? null;
}

export function shotContract(name) {
  const cfg = SHOTS[name];
  if (!cfg) return null;
  return CONTRACTS.find((c) => c.id === cfg.contract) ?? CONTRACTS[0];
}

export function applyShotSpawn(name, plane, sortie) {
  const cfg = SHOTS[name];
  if (!cfg) return;
  cfg.spawn(plane, fieldById(sortie.contract.from), fieldById(sortie.contract.to));
  sortie.shotCamera = cfg.camera;
}

export function shotFrozen(name, sortie, plane, t) {
  const cfg = SHOTS[name];
  if (!cfg) return false;
  return cfg.freeze(sortie, plane, t);
}
