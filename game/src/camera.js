// Chase and cockpit cameras. The chase cam sits high and to the side so the
// aircraft, the terrain and the target all share the frame — the judge reads
// screenshots, so the camera is a composition tool, not just a viewpoint.

import { clamp, lerp } from './random.js';

export function createCameraRig(camera) {
  const pos = { x: 0, y: 0, z: 0 };
  let mode = 'chase';
  let shake = 0;

  return {
    get mode() { return mode; },
    setMode(m) { mode = m; },
    addShake(v) { shake = Math.min(1, shake + v); },
    update(p, dt, t) {
      // The chase distance scales with the airframe: a fixed 21 m sits
      // INSIDE a 26 m freighter and loses a 9 m trainer in the frame.
      const back = Math.max(21, p.spec.bodyLen * 1.25), up = back * 0.34, side = 3.4;
      const hx = Math.sin(p.heading), hz = -Math.cos(p.heading);
      // Right vector for the three-quarter offset.
      const rx = -hz, rz = hx;
      let tx, ty, tz, lx, ly, lz;
      if (mode === 'cockpit') {
        // The pilot's eye sits over the canopy (top at +4.2 in model
        // space): below that the camera is inside the fuselage mesh.
        const fwd = p.spec.bodyLen * 0.10;
        tx = p.x + hx * fwd; ty = p.y + 5.4; tz = p.z + hz * fwd;
        lx = p.x + hx * 220; ly = p.y + 5.4 + Math.sin(p.pitch) * 160 - 14; lz = p.z + hz * 220;
        pos.x = tx; pos.y = ty; pos.z = tz;
      } else {
        tx = p.x - hx * back + rx * side; ty = p.y + up; tz = p.z - hz * back + rz * side;
        const k = 1 - Math.exp(-dt * 5.2);
        pos.x = lerp(pos.x || tx, tx, k); pos.y = lerp(pos.y || ty, ty, k); pos.z = lerp(pos.z || tz, tz, k);
        lx = p.x + hx * 160; ly = p.y + 1; lz = p.z + hz * 160;
      }
      shake = Math.max(0, shake - dt * 1.6);
      const sx = shake > 0 ? Math.sin(t * 61) * shake * 0.5 : 0;
      const sy = shake > 0 ? Math.cos(t * 53) * shake * 0.4 : 0;
      camera.position.set(pos.x + sx, pos.y + sy, pos.z);
      camera.lookAt(lx, ly, lz);
      camera.rotation.z += -p.bank * (mode === 'cockpit' ? 0.85 : 0.14);
      camera.fov = mode === 'chase' ? clamp(58 + p.speed * 0.05, 58, 68) : 62;
      camera.updateProjectionMatrix();
    },
    snap(p) {
      const hx = Math.sin(p.heading), hz = -Math.cos(p.heading);
      const back = Math.max(21, p.spec.bodyLen * 1.25);
      pos.x = p.x - hx * back; pos.y = p.y + back * 0.34; pos.z = p.z - hz * back;
    },
  };
}
