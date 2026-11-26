// Autopilot: flies a whole sortie — takeoff roll, climb, cruise, survey
// gates, an engine-out glide if the sortie cuts the engine, a stabilised
// approach, flare and stop. It exists so every contract is proven flyable
// by the machine before a human (or a judge) ever sees it, and so staged
// screenshots are real flights frozen mid-air, not poses.

import { fieldById, heightAt } from './data/zones.js';
import { sortieTarget } from './missions.js';
import { stallSpeedOf } from './flightModel.js';
import { angDiff, clamp } from './random.js';

// Staged screenshots spawn the aeroplane already on final: prime the
// phase machine so it flies the approach instead of departing into a
// full pattern first.
export function primeApproach(ap) {
  ap.phase = 'approach';
  ap.leg = 'final';
}

export function createAutopilot() {
  const ap = {
    phase: 'roll', // roll -> climb -> cruise -> approach -> glide -> final -> stop
    throttlePos: 0,
    stuckT: 0,
    lastX: 0, lastZ: 0,
  };
  return ap;
}

function steer(p, tx, tz, dt) {
  const want = Math.atan2(tx - p.x, -(tz - p.z));
  const err = angDiff(want, p.heading);
  return clamp(err * 1.5, -1, 1);
}

// Cruise altitude that clears the terrain actually under the route: sample
// the straight line to the target and fly 260 m above its highest point.
function routeCruiseAlt(p, tx, tz, destAlt) {
  let top = destAlt;
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    top = Math.max(top, heightAt(p.x + (tx - p.x) * f, p.z + (tz - p.z) * f));
  }
  return top + 260;
}

export function autopilotInput(ap, p, sortie, dt) {
  const input = { throttle: ap.throttlePos, pitch: 0, roll: 0, flaps: p.flaps, gearDown: p.gearDown, brake: false };
  const stall = stallSpeedOf(p);
  const target = sortieTarget(sortie);
  const dest = fieldById(sortie.contract.to);
  const groundDest = heightAt(dest.x, dest.z);
  const distDest = Math.hypot(dest.x - p.x, dest.z - p.z);
  const distTarget = Math.hypot(target.x - p.x, target.z - p.z);

  // Stuck watchdog: snapshot the position every 3 s; if the aeroplane has
  // barely moved across a whole snapshot window while airborne, reset to
  // cruise. (A per-step distance check is a trap: at approach speed the
  // plane moves ~1.2 m per step, which reads as "stuck" forever.)
  ap.watchT = (ap.watchT ?? 0) + dt;
  if (ap.watchT >= 3) {
    const moved = Math.hypot(p.x - (ap.lastX ?? p.x), p.z - (ap.lastZ ?? p.z));
    ap.stuckT = moved < 15 && !p.onGround ? ap.stuckT + 3 : 0;
    ap.lastX = p.x; ap.lastZ = p.z; ap.watchT = 0;
    if (ap.stuckT >= 12) { ap.phase = 'cruise'; ap.leg = 'join'; ap.stuckT = 0; }
  }

  if (p.onGround) {
    if (sortie.phase !== 'work') { input.throttle = 0; input.brake = true; ap.throttlePos = 0; return input; }
    if (ap.phase === 'roll' && !sortie.grade) {
      input.throttle = 1; ap.throttlePos = 1;
      // Hold the departure runway's heading on the roll — steering at the
      // destination from the ground yaws the plane off the strip.
      input.roll = clamp(angDiff(sortie.fromField.heading, p.heading) * 1.2, -1, 1) * 0.4;
      input.pitch = p.groundSpeed > stall * 0.95 ? 1 : 0;
      if (!p.onGround) ap.phase = 'climb';
      return input;
    }
    input.throttle = 0; input.brake = true; ap.throttlePos = 0;
    return input;
  }

  const agl = p.y - heightAt(p.x, p.z);
  const cruiseAlt = routeCruiseAlt(p, target.x, target.z, Math.max(groundDest, heightAt(target.x, target.z)));
  // Terrain clearance looks AHEAD, never just under the nose: a floor
  // sampled at the plane's own position is a wall detector that fires
  // after the wall.
  const aheadFloor = Math.max(
    heightAt(p.x + Math.sin(p.heading) * 300, p.z - Math.cos(p.heading) * 300),
    heightAt(p.x + Math.sin(p.heading) * 700, p.z - Math.cos(p.heading) * 700),
  ) + 150;

  // Airborne with the phase still at 'roll' means the wheels just left:
  // the climb owns the aeroplane from here. An engine that quits in the
  // climb or cruise skips every pattern: the glide owns it, directly.
  if (ap.phase === 'roll') ap.phase = 'climb';
  if (p.engineOut) {
    if (ap.phase !== 'approach' && ap.phase !== 'glide') ap.phase = 'glide';
    ap.leg = 'final';
  }

  if (ap.phase === 'climb') {
    input.throttle = 1; ap.throttlePos = 1;
    input.roll = steer(p, target.x, target.z, dt);
    // Full-throttle climb at a fixed attitude, gated on SPEED, never on
    // AGL — over rising ground an AGL gate keeps the nose down until the
    // hillside arrives.
    input.pitch = p.speed < stall + 10 ? 0.08 : 0.42;
    input.flaps = 1;
    if (agl > 190) { ap.phase = 'cruise'; input.flaps = 0; }
    return input;
  }

  // The approach may only be entered from cruise — entering it straight off
  // the runway (same-field circuits) orbits the threshold forever. It is
  // entered early: the join leg needs room to reach the gate behind the
  // threshold and turn in.
  if (ap.phase === 'cruise' && target.kind === 'field' && distDest < 3400) {
    ap.phase = p.engineOut ? 'glide' : 'approach';
    // A deadstick flies no pattern: it takes the final it has, directly.
    ap.leg = p.engineOut ? 'final' : 'join';
  }

  if (ap.phase === 'cruise') {
    // Two-segment descent for field targets: hold cruise until the 8-degree
    // profile reaches the field, then ride it down to the final gate —
    // a 4.5-degree slope from a high cruise needs more map than exists.
    const profileAlt = groundDest + Math.max(330, (distDest - 1200) * 0.14);
    const wantAlt = target.kind === 'gate'
      ? (distTarget > 1500 ? Math.max(cruiseAlt, aheadFloor)
        : distTarget > 500 ? Math.max(target.y, aheadFloor + 40) : target.y)
      : Math.min(cruiseAlt, Math.max(profileAlt, aheadFloor));
    input.roll = steer(p, target.x, target.z, dt);
    input.pitch = clamp((wantAlt - p.y) * 0.006, -0.5, 0.55);
    const wantSpeed = p.spec.cruiseSpeed;
    ap.throttlePos = clamp(ap.throttlePos + (p.speed < wantSpeed ? dt * 0.25 : -dt * 0.25), 0.25, 0.92);
    input.throttle = ap.throttlePos;
    input.gearDown = false;
    if (target.kind === 'gate' && distTarget < 240) input.pitch = clamp((target.y - p.y) * 0.01, -0.6, 0.6);
    return input;
  }

  // Anything that is not cruise, approach or glide does not get to fly the
  // approach by fall-through: send it back to cruise.
  if (ap.phase !== 'approach' && ap.phase !== 'glide') ap.phase = 'cruise';
  if (ap.phase === 'cruise') {
    ap.approachClock = 0;
    const profileAlt2 = groundDest + Math.max(330, (distDest - 1200) * 0.14);
    const wantAlt2 = target.kind === 'gate' ? target.y
      : Math.min(cruiseAlt, Math.max(profileAlt2, heightAt(p.x, p.z) + 170));
    input.roll = steer(p, target.x, target.z, dt);
    input.pitch = clamp((wantAlt2 - p.y) * 0.006, -0.5, 0.55);
    const wantSpeed2 = p.spec.cruiseSpeed;
    ap.throttlePos = clamp(ap.throttlePos + (p.speed < wantSpeed2 ? dt * 0.25 : -dt * 0.25), 0.25, 0.92);
    input.throttle = ap.throttlePos;
    input.gearDown = false;
    return input;
  }

  // Approach / glide, as a two-leg state machine.
  // JOIN: fly to a gate 1,700 m behind the threshold at pattern altitude.
  // FINAL: track the centreline with a carrot 350 m ahead of the plane's
  // own projection (never a fixed point — pursuit of a fixed point whips
  // at close range), and ride the 4.5-degree slope with pitch; throttle
  // holds the speed, or pitch does when the engine is out.
  const aimFrac = dest.length < 700 ? 0.46 : 0.42;
  const aimX = dest.x - Math.sin(dest.heading) * dest.length * aimFrac;
  const aimZ = dest.z + Math.cos(dest.heading) * dest.length * aimFrac;
  const distAim = Math.hypot(aimX - p.x, aimZ - p.z);
  const dirX = Math.sin(dest.heading), dirZ = -Math.cos(dest.heading);
  // Along-track (metres short of the threshold, + before it) and cross-track.
  const relX = p.x - aimX, relZ = p.z - aimZ;
  const along = -(relX * dirX + relZ * dirZ);
  const cte = relX * dirZ - relZ * dirX;
  const aheadY = heightAt(p.x + Math.sin(p.heading) * 150, p.z - Math.cos(p.heading) * 150);
  // The terrain floor may hold the plane above the slope, but never so far
  // above it that the last 500 m needs a dive: the floor's excess over the
  // slope is capped by a flyable descent gradient back to the line.
  // The slope line ends 2 m UNDER the threshold: a line that ends above
  // the surface is a line the aeroplane can fly forever without landing.
  // A sortie whose engine is going to quit flies a steeper, higher profile
  // from the start, so the glide it ends up in matches the line it flew.
  const slopeTan = p.engineOut || sortie.contract.setup?.engineOutAt ? 0.133 : dest.steep ? 0.13 : 0.078;
  const slopeBase = groundDest + slopeTan * Math.max(along, 0) - 2;
  const slopeAlt = Math.max(
    slopeBase,
    Math.min(aheadY + 42, slopeBase + Math.max(along - 350, 0) * 0.16),
  );
  input.gearDown = distAim < (p.engineOut ? 2600 : 1900);
  input.flaps = distAim < 1100 ? 2 : 1;

  if (ap.leg !== 'final') {
    const fixX = aimX - dirX * 2600;
    const fixZ = aimZ - dirZ * 2600;
    const distFix = Math.hypot(fixX - p.x, fixZ - p.z);
    const joinAlt = Math.max(groundDest + 210, aheadFloor + 30);
    let sx = fixX, sz = fixZ;
    // Deadstick and high on the join: weave to bleed energy.
    if (p.engineOut && p.y - slopeAlt > 120) {
      const off = Math.sin(sortie.t * 0.35) * 480;
      sx += dirZ * off; sz -= dirX * off;
    }
    input.roll = steer(p, sx, sz, dt);
    input.pitch = clamp((joinAlt - p.y) * 0.012, -0.5, 0.5);
    if (p.engineOut) { input.throttle = 0; ap.throttlePos = 0; }
    else {
      ap.throttlePos = clamp(ap.throttlePos + (p.speed < p.spec.cruiseSpeed * 0.8 ? dt * 0.25 : -dt * 0.25), 0.15, 0.85);
      input.throttle = ap.throttlePos;
    }
    // Final begins from a POSITION, not from reaching the fix: on the
    // approach side, roughly on the centreline, heading the runway's way.
    const linedUp = along > 300 && along < 2300 && Math.abs(cte) < 320
      && Math.abs(angDiff(p.heading, dest.heading)) < 0.75;
    if (linedUp || (distFix < 450 && along > 300)) ap.leg = 'final';
    return input;
  }

  // FINAL.
  // A powered final that is hopelessly off the centreline goes around and
  // rejoins. A deadstick has no go-around: it lands with what it has.
  if (!p.engineOut && Math.abs(cte) > 130 && along > 250 && along < 900) { ap.phase = 'cruise'; ap.leg = 'join'; return input; }
  const carrotAlong = Math.max(along - 350, -200);
  let cx = aimX - dirX * carrotAlong;
  let cz = aimZ - dirZ * carrotAlong;
  // Deadstick with energy to burn on final: weave across the centreline.
  if (p.engineOut && p.y - slopeAlt > 200 && along > 600) {
    const off = Math.sin(sortie.t * 0.3) * 380;
    cx += dirZ * off; cz -= dirX * off;
  }
  input.roll = clamp(steer(p, cx, cz, dt), -0.55, 0.55);
  if (p.y - groundDest < 25) {
    input.roll = clamp(angDiff(dest.heading, p.heading) * 1.2, -1, 1) * 0.5;
  }
  if (p.engineOut) {
    input.throttle = 0; ap.throttlePos = 0;
    // Glide: pitch flies the SPEED — nose DOWN when slow, up when fast
    // (the sign is the whole game: pitch up to "hold" a speed bleeds the
    // speed it is holding, into a stall). The slope may only push the
    // nose further down, never up: a glide cannot climb back to a line.
    input.pitch = clamp((p.speed - (stall + 13)) * 0.06, -0.45, 0.45)
      + clamp((slopeAlt - p.y) * 0.0015, -0.12, 0);
  } else {
    input.pitch = clamp((slopeAlt - p.y) * 0.035, -0.55, 0.5);
    const wantSpeed = stall + (dest.length < 700 ? 8 : 11);
    ap.throttlePos = clamp(ap.throttlePos + (p.speed < wantSpeed ? dt * 0.3 : -dt * 0.3), 0, 0.85);
    input.throttle = ap.throttlePos;
  }
  // A bounce just settles back: throttle off, gentle descent onto the strip.
  if (sortie.grade && p.y - heightAt(p.x, p.z) < 30) {
    input.throttle = 0; ap.throttlePos = 0;
    input.pitch = clamp((heightAt(p.x, p.z) + 1 - p.y) * 0.03, -0.3, 0.2);
  }
  return input;
}
