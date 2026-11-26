// Low-poly aircraft built from primitives: a tapered fuselage, flat wings
// with dihedral, a tail that varies by airframe, a glass canopy, spinning
// props and wingtip lights. Each airframe's data carries its silhouette
// numbers and livery, so the four planes read as four designs, not recolors.

import * as THREE from '../vendor/three.module.min.js';

export function buildAircraft(spec) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: spec.bodyColor, flatShading: true, roughness: 0.55, metalness: 0.18 });
  const accent = new THREE.MeshStandardMaterial({ color: spec.accentColor, flatShading: true, roughness: 0.55, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, flatShading: true, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, flatShading: true, roughness: 0.15, metalness: 0.4 });

  const L = spec.bodyLen, W = spec.wingSpan;

  // Fuselage: stretched octahedron reads as a faceted teardrop.
  const fus = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), body);
  fus.scale.set(1.6, 1.5, L / 2);
  fus.position.y = 2.2;
  g.add(fus);
  // Nose taper cone toward +z (the nose).
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.45, L * 0.24, 6), accent);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.2, L / 2 + L * 0.1);
  g.add(nose);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, L * 0.72), accent);
  stripe.position.set(0, 1.15, 0);
  g.add(stripe);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), glass);
  canopy.scale.set(1.05, 0.85, 2.4);
  canopy.position.set(0, 3.35, L * 0.16);
  g.add(canopy);

  // Wing: one flat box with dihedral halves.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W / 2, 0.32, 3.1), body);
    wing.position.set(side * W / 4, 2.5, L * 0.05);
    wing.rotation.z = side * 0.09;
    g.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.2), accent);
    tip.position.set(side * (W / 2 - 0.2), 2.5 + Math.sin(0.09) * W / 4, L * 0.05);
    g.add(tip);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff4444 : 0x44ff77 }));
    light.position.copy(tip.position);
    g.add(light);
  }

  // Tail: standard, twin-boom or V by spec.
  const tz = -L / 2 + 0.6;
  if (spec.tail === 'twin') {
    for (const side of [-1, 1]) {
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, L * 0.52, 6), body);
      boom.rotation.x = Math.PI / 2;
      boom.position.set(side * W * 0.18, 2.4, -L * 0.22);
      g.add(boom);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 2.2), accent);
      fin.position.set(side * W * 0.18, 3.9, tz - 1);
      g.add(fin);
    }
    const stab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, 0.3, 2.2), body);
    stab.position.set(0, 4.6, tz - 1);
    g.add(stab);
  } else if (spec.tail === 'v') {
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 2.4), accent);
      fin.position.set(side * 1.6, 3.6, tz);
      fin.rotation.z = side * 0.6;
      g.add(fin);
    }
  } else {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 2.6), accent);
    fin.position.set(0, 4.2, tz);
    g.add(fin);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.34, 0.3, 2.1), body);
    stab.position.set(0, 2.6, tz);
    g.add(stab);
  }

  // Engines: props on the nose (single) or wing nacelles (twin).
  const props = [];
  const bladeSets = [];
  function addProp(x, y, z, r) {
    const hub = new THREE.Group();
    // A translucent blur disc behind the blades: a spinning prop reads
    // as a disc, not as three sticks — a frozen blade straight up fills
    // a cockpit frame like a monolith.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({ color: 0x14171c, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
    );
    hub.add(disc);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 6), dark);
    spinner.rotation.x = Math.PI / 2;
    hub.add(spinner);
    const set = [spinner];
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, r, 0.12), dark);
      blade.position.y = r / 2;
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      holder.add(blade);
      hub.add(holder);
      set.push(holder);
    }
    bladeSets.push(set);
    hub.position.set(x, y, z);
    g.add(hub);
    props.push(hub);
    return hub;
  }
  if (spec.engines === 2) {
    for (const side of [-1, 1]) {
      const nac = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), accent);
      nac.scale.set(0.95, 0.95, 2.6);
      nac.position.set(side * W * 0.24, 2.4, L * 0.12);
      g.add(nac);
      addProp(side * W * 0.24, 2.4, L * 0.12 + 2.8, 2.2);
    }
  } else {
    // Radius 1.9: a real prop on a 9 m airframe spans ~2 m, and from the
    // pilot's eye the disc must stay BELOW eye level — at 3.1 the disc
    // top rose above the eye and filled the cockpit frame.
    addProp(0, 2.2, L / 2 + L * 0.22, 1.9);
  }

  // Fixed gear legs + wheels (low-poly planes keep it simple and readable).
  const gear = new THREE.Group();
  for (const [x, z] of [[-1.7, 1.2], [1.7, 1.2], [0, -L * 0.32]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 5), dark);
    leg.position.set(x, 0.85, z);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.5, 8), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.4, z);
    gear.add(leg, wheel);
  }
  g.add(gear);

  return {
    group: g,
    // From the pilot's seat the blades vanish into the blur disc; from
    // outside they read as a prop. A 3-blade prop always has one blade
    // in the upper half — frozen mid-frame it reads as wreckage.
    setPropDetail(v) {
      for (const set of bladeSets) for (const b of set) b.visible = v;
    },
    update(p, t) {
      for (const prop of props) prop.rotation.z = t * (6 + p.throttle * 55) * (p.engineOut ? 0.25 : 1);
      gear.visible = p.gearDown;
    },
  };
}

// Pose the model from the flight state: nose is +z locally, heading 0 faces
// -z world (north), pitch climbs the nose, bank rolls around the nose axis.
export function poseAircraft(group, p) {
  group.position.set(p.x, p.y + 0.4, p.z);
  group.rotation.order = 'YXZ';
  group.rotation.y = Math.PI - p.heading;
  group.rotation.x = -p.pitch * 0.9;
  group.rotation.z = p.bank * 0.95;
}
