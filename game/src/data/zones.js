// The Cinder Reach: one volcanic region, eight strips. Terrain is analytic —
// a caldera ring, a knife ridge, a salt pan, a canyon slot, an atoll and a
// rock stack in the sea — with every airfield sitting on a flattened disc at
// its surveyed elevation, so heightAt() is the single truth the model, the
// terrain mesh and the autopilot all share.

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function gauss(d, s) { return Math.exp(-(d * d) / (2 * s * s)); }

export const AIRFIELDS = [
  { id: 'kestrel', name: 'Kestrel Field', code: 'KRSL', x: -3200, z: 2600, heading: 1.45, length: 1180, elev: 6, town: true },
  { id: 'ashen', name: 'Ashen Deck', code: 'ASHD', x: -400, z: -850, heading: 1.35, length: 720, elev: 1340, town: false, steep: true },
  { id: 'ninemile', name: 'Nine-Mile', code: 'NM9', x: 3600, z: 300, heading: -0.7, length: 2000, elev: 62, town: false },
  { id: 'cut4', name: 'Cut 4', code: 'CUT4', x: 2400, z: 2900, heading: -0.35, length: 480, elev: 420, town: false },
  { id: 'tidegate', name: 'Tidegate', code: 'TGT', x: -4600, z: -300, heading: 0, length: 610, elev: 3, town: true },
  { id: 'hjalmar', name: 'Hjalmar Field', code: 'HJLM', x: -2900, z: -2900, heading: 0.5, length: 900, elev: 88, town: true },
  { id: 'vesper', name: 'Vesper Ridge', code: 'VSPR', x: 1500, z: -3100, heading: 0.15, length: 560, elev: 1780, town: false },
  { id: 'petrel', name: 'Petrel Platform', code: 'PTR7', x: 4300, z: 1800, heading: -0.5, length: 340, elev: 22, town: false },
];

export function fieldById(id) {
  return AIRFIELDS.find((f) => f.id === id) ?? AIRFIELDS[0];
}

export const LANDMARKS = [
  { kind: 'lighthouse', x: -4980, z: 260 },
  { kind: 'tower', x: -3030, z: 2320 },
  { kind: 'wreck', x: 3900, z: 2250 },
];

function rawHeight(x, z) {
  // Rolling base.
  let h = 30 + 15 * Math.sin(x * 0.0011 + 1.3) * Math.cos(z * 0.0009) + 10 * Math.sin(x * 0.0037) * Math.sin(z * 0.0029 + 0.7);

  // The sea: east beyond the coast, and the western water around the atoll.
  h -= smoothstep(4350, 5300, x) * 120;
  h -= smoothstep(3750, 4550, -x) * 55;

  // Caldera: a ring ridge with a bowl inside, centred north of mid-field.
  const dc = Math.hypot(x + 400, z + 1900);
  h += gauss(dc - 1050, 250) * 1330;
  h += gauss(dc, 720) * 300;

  // Vesper knife ridge, running east-west in the far north-east.
  h += gauss(z + 3100, 430) * gauss(x - 1500, 1650) * 1740;

  // Hjalmar's cold shelf and the ridge its final crosses.
  h += gauss(Math.hypot(x + 2900, z + 2900), 1500) * 95;
  h += gauss(z + 2280, 95) * gauss(x + 2700, 1300) * 26;

  // Nine-Mile salt pan: a broad flat at pan height.
  const panW = gauss(Math.hypot(x - 3600, z - 300), 1500);
  h = h * (1 - panW * 0.92) + 62 * panW * 0.92;

  // Sabre Canyon: a carved slot running north from Cut 4, walls either side.
  // The whole feature is laterally enveloped — beyond ~1,100 m from the
  // axis there is no canyon, or the wall raise would lift half the map.
  const axisX = 2400 + (z - 2900) * 0.25;
  const u = Math.abs(x - axisX);
  const inCanyon = smoothstep(1500, 2100, z) * (1 - smoothstep(3500, 3900, z))
    * (1 - smoothstep(500, 1100, u));
  const wall = smoothstep(130, 330, u) * inCanyon;
  h = h * (1 - wall * 0.35) + (h + 330) * wall * 0.35;
  const floor = (1 - smoothstep(60, 150, u)) * inCanyon;
  h = h * (1 - floor * 0.55) + 420 * floor * 0.55;

  // Tidegate atoll: a low coral disc in the western water.
  h += gauss(Math.hypot(x + 4600, z + 300), 430) * 16;

  // The Teeth: rock stacks marking the eastern shelf.
  h += gauss(Math.hypot(x - 4650, z - 700), 90) * 95;
  h += gauss(Math.hypot(x - 4780, z - 1250), 70) * 120;
  h += gauss(Math.hypot(x - 4520, z - 2550), 80) * 80;

  // Petrel's rock: the stack the deck is bolted to.
  h += gauss(Math.hypot(x - 4300, z - 1800), 130) * 34;

  return h;
}

const PAD_R = (f) => f.length * 0.85 + 160;

export function heightAt(x, z) {
  // The sea floor is not a surface: physics ground never goes below -2, so
  // a water arrival is a ditch at sea level, not a landing on the seabed.
  let h = Math.max(rawHeight(x, z), -2);
  // Flatten toward each field's surveyed elevation inside its disc.
  for (const f of AIRFIELDS) {
    const d = Math.hypot(x - f.x, z - f.z);
    const r = PAD_R(f);
    if (d < r) {
      const w = 1 - smoothstep(r * 0.68, r, d);
      h = h * (1 - w) + f.elev * w;
    }
  }
  return h;
}

// Surface truth for the model: on a strip means inside the field's disc and
// near its elevation.
export function fieldAt(x, z) {
  for (const f of AIRFIELDS) {
    if (Math.hypot(x - f.x, z - f.z) < f.length * 0.62) return f;
  }
  return null;
}
