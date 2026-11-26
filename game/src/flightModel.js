// Arcade-true flight model: lift against a stall speed the damage and flaps
// move, coordinated turns out of bank, ground effect, a ground roll that
// respects thrust, fuel that burns and an engine that can quit — the stakes
// the missions are built on. Pure state + step, no rendering, so the node
// harness flies exactly what the browser flies.

import { FLIGHT } from './config.js';
import { clamp } from './random.js';

export function createPlane(spec, spawn) {
  return {
    spec,
    x: spawn.x, y: spawn.y, z: spawn.z,
    heading: spawn.heading ?? 0,
    pitch: 0, bank: 0,
    speed: spawn.speed ?? 0, // along the nose, m/s
    groundSpeed: 0, // scalar roll speed while on the ground
    vy: 0,
    throttle: 0,
    flaps: 0, // 0 up, 1 half, 2 full
    gearDown: true,
    brake: false,
    onGround: spawn.onGround ?? true,
    fuel: spawn.fuel ?? spec.fuelCapacity,
    damage: spawn.damage ?? 0,
    engineOut: false,
    flameoutAnnounced: false,
    stalled: false,
    crashed: false,
    stopped: false,
    airTime: 0,
  };
}

export function stallSpeedOf(p) {
  const flapFactor = [1, 0.93, 0.86][p.flaps] ?? 1;
  return p.spec.stallSpeed * flapFactor * (1 + p.damage * 0.0022);
}

// stepPlane(p, input, dt, env) -> events[]
// input: { throttle, pitch (-1..1), roll (-1..1), flaps, gearDown, brake }
// env:   { groundY, windX, windZ, gust }  (gust: extra vertical m/s this step)
export function stepPlane(p, input, dt, env) {
  const events = [];
  if (p.crashed) return events;
  const spec = p.spec;

  p.throttle = p.engineOut || p.fuel <= 0 ? 0 : clamp(input.throttle, 0, 1);
  p.flaps = input.flaps ?? p.flaps;
  p.gearDown = input.gearDown ?? p.gearDown;
  p.brake = !!input.brake;

  // Fuel: burns with throttle; an empty tank is a flameout like any other.
  if (!p.engineOut && p.fuel > 0) {
    p.fuel = Math.max(0, p.fuel - spec.burnPerSec * (0.25 + 0.75 * p.throttle) * dt);
    if (p.fuel <= 0 && !p.flameoutAnnounced) {
      p.flameoutAnnounced = true;
      events.push({ type: 'flameout', cause: 'fuel' });
    }
  }

  const stall = stallSpeedOf(p);
  const thrustAccel = p.throttle * spec.thrust * (1 - p.damage * 0.004);
  const dragK = spec.drag * (1 + p.flaps * 0.35) * (p.gearDown ? 1.18 : 1);

  if (p.onGround) {
    // Ground roll: thrust against drag and brake; the nose only comes up
    // once the wing is nearly flying.
    const rollAccel = thrustAccel - dragK * p.groundSpeed * 0.06 - (p.brake ? 5.5 : 0.35);
    p.groundSpeed = Math.max(0, p.groundSpeed + rollAccel * dt);
    p.speed = p.groundSpeed;
    p.x += Math.sin(p.heading) * p.groundSpeed * dt;
    p.z += -Math.cos(p.heading) * p.groundSpeed * dt;
    p.y = env.groundY;
    p.vy = 0;
    p.stopped = p.groundSpeed < 0.4 && input.throttle < 0.05;
    const rotate = p.groundSpeed > stall * 0.92 && input.pitch > 0.25;
    if (rotate) {
      p.onGround = false;
      p.pitch = 0.14;
      events.push({ type: 'liftoff' });
    }
    p.bank = clamp(p.bank + ((input.roll * 0.25) - p.bank) * Math.min(1, dt * 4), -0.3, 0.3);
    if (p.groundSpeed > 1) p.heading += Math.sin(p.bank) * 0.35 * dt;
    return events;
  }

  p.airTime += dt;
  p.stopped = false;

  // Bank and pitch chase the stick.
  const targetBank = clamp(input.roll, -1, 1) * FLIGHT.maxBank;
  p.bank += clamp(targetBank - p.bank, -FLIGHT.rollResponse * dt, FLIGHT.rollResponse * dt);
  const targetPitch = clamp(input.pitch, -1, 1) * FLIGHT.maxPitch;
  p.pitch += clamp(targetPitch - p.pitch, -FLIGHT.pitchResponse * dt, FLIGHT.pitchResponse * dt);

  // Coordinated turn: bank yaws the nose, more when slow and steep.
  p.heading += Math.sin(p.bank) * FLIGHT.turnRatePerBank * dt * clamp(p.speed / 45, 0.55, 1.25);

  // Energy: thrust and drag along the flight path, gravity on the slope.
  const accel = thrustAccel - dragK * p.speed * p.speed * 0.004 - Math.sin(p.pitch) * FLIGHT.gravity * 0.92;
  p.speed = Math.max(0, p.speed + accel * dt);

  // Lift: below the (moving) stall speed the wing gives up progressively.
  const liftFrac = clamp(p.speed / stall, 0, 1.12);
  const wasStalled = p.stalled;
  p.stalled = liftFrac < 0.98;
  if (p.stalled && !wasStalled) events.push({ type: 'stall' });

  let vy = Math.sin(p.pitch) * p.speed * Math.min(1, liftFrac);
  vy -= FLIGHT.gravity * (1 - Math.min(1, liftFrac)) * 0.94;
  if (p.stalled) vy -= (0.98 - liftFrac) * 9.0;
  // Ground effect: the last metres cushion the sink.
  const agl = p.y - env.groundY;
  if (agl < FLIGHT.groundEffectHeight && vy < 0) vy *= 0.55 + 0.45 * (agl / FLIGHT.groundEffectHeight);
  p.vy = vy + (env.gust ?? 0);

  p.x += (Math.sin(p.heading) * Math.cos(p.pitch) * p.speed + (env.windX ?? 0)) * dt;
  p.z += (-Math.cos(p.heading) * Math.cos(p.pitch) * p.speed + (env.windZ ?? 0)) * dt;
  p.y += p.vy * dt;

  if (p.y <= env.groundY) {
    p.y = env.groundY;
    const sink = -p.vy;
    const gearFactor = p.gearDown ? 1 : 1.9;
    events.push({
      type: 'touchdown',
      sink,
      speed: p.speed,
      gearDown: p.gearDown,
      severity: sink * gearFactor,
    });
    p.onGround = true;
    p.groundSpeed = p.speed;
    p.pitch = 0;
    if (sink * gearFactor > 9.5 || p.speed > spec.cruiseSpeed * 1.65) {
      p.crashed = true;
      events.push({ type: 'crash', sink, speed: p.speed });
    }
  }
  return events;
}

// Terrain strike check the conductor runs against real ground height: flying
// into a slope is a crash whatever the altimeter said.
export function terrainStrike(p, groundY) {
  if (p.onGround) return false;
  return p.y <= groundY + 0.5 && p.vy <= 0.5;
}

export function applyDamage(p, points, events, cause) {
  const before = p.damage;
  p.damage = clamp(p.damage + points, 0, 100);
  if (p.damage >= 100 && before < 100) {
    p.crashed = true;
    events.push({ type: 'crash', cause });
  }
  return p.damage;
}
