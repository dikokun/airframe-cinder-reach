// Low-poly world building: a flat-shaded heightfield coloured by height and
// slope, a faceted sea, instanced cone trees and block houses, runway strips
// with threshold marks and edge lights, and puff clouds built from squashed
// icosahedrons. Everything is geometry from the zones data — no textures, no
// network — so the art direction is one consistent low-poly language.

import * as THREE from '../vendor/three.module.min.js';
import { AIRFIELDS, LANDMARKS, heightAt } from './data/zones.js';
import { mulberry32 } from './random.js';
import { WORLD } from './config.js';

const PALETTE = {
  deep: new THREE.Color(0x2e6f8e),
  shallow: new THREE.Color(0x3f97b8),
  sand: new THREE.Color(0xe3cf9e),
  grass: new THREE.Color(0x69a85c),
  meadow: new THREE.Color(0x8fbc67),
  rock: new THREE.Color(0x8d8578),
  high: new THREE.Color(0xb9b2a4),
  snow: new THREE.Color(0xf2f0e9),
};

function groundColor(x, z, y, slope, out) {
  if (y < 2.5) return out.copy(PALETTE.sand);
  if (slope > 0.62) return out.copy(PALETTE.rock);
  if (y > 620) return out.copy(PALETTE.snow);
  if (y > 380) return out.copy(PALETTE.high);
  const n = Math.sin(x * 0.011 + z * 0.017) * 0.5 + 0.5;
  return out.copy(n > 0.55 ? PALETTE.meadow : PALETTE.grass);
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  const size = WORLD.size;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const s = Math.abs(heightAt(x + 24, z) - y) / 24 + Math.abs(heightAt(x, z + 24) - y) / 24;
    groundColor(x, z, y, s, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
  group.add(ground);

  // Faceted sea: a low plane with a gentle vertex ripple, semi-gloss.
  const seaGeo = new THREE.PlaneGeometry(size * 2.4, size * 2.4, 24, 24);
  seaGeo.rotateX(-Math.PI / 2);
  const sp = seaGeo.attributes.position;
  const srng = mulberry32(77);
  for (let i = 0; i < sp.count; i++) sp.setY(i, -1.6 + srng() * 1.1);
  seaGeo.computeVertexNormals();
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: PALETTE.shallow, flatShading: true, roughness: 0.32, metalness: 0.25 }));
  sea.position.y = WORLD.seaLevel;
  group.add(sea);

  buildVegetation(group);
  buildSettlements(group);
  for (const f of AIRFIELDS) group.add(buildRunway(f));
  for (const lm of LANDMARKS) group.add(buildLandmark(lm));
  buildClouds(group);
  scene.add(group);
  return group;
}

function buildVegetation(group) {
  const rng = mulberry32(1234);
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 5, 5);
  const crownGeo = new THREE.ConeGeometry(4.6, 13, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, flatShading: true, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3e7d44, flatShading: true, roughness: 1 });
  const N = 900;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < N * 3 && placed < N; i++) {
    const x = (rng() - 0.5) * WORLD.size * 0.94;
    const z = (rng() - 0.5) * WORLD.size * 0.94;
    const y = heightAt(x, z);
    if (y < 4 || y > 430) continue;
    if (AIRFIELDS.some((f) => Math.hypot(f.x - x, f.z - z) < 190)) continue;
    const s = 0.8 + rng() * 1.5;
    sc.set(s, s, s);
    m.compose(new THREE.Vector3(x, y + 2.2 * s, z), q, sc);
    trunks.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, y + (5 + 6.5) * s, z), q, sc);
    crowns.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  group.add(trunks, crowns);
}

function buildSettlements(group) {
  const rng = mulberry32(555);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8ddc4, flatShading: true, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb8543e, flatShading: true, roughness: 0.95 });
  const houses = new THREE.Group();
  for (const f of AIRFIELDS) {
    if (!f.town) continue;
    const n = 6 + Math.floor(rng() * 6);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = 150 + rng() * 190;
      const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
      const y = heightAt(x, z);
      if (y < 3) continue;
      const w = 9 + rng() * 7, h = 5 + rng() * 4, dep = 8 + rng() * 6;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), wallMat);
      base.position.set(x, y + h / 2, z);
      base.rotation.y = rng() * Math.PI;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dep) * 0.78, 4.5, 4), roofMat);
      roof.position.set(x, y + h + 2.2, z);
      roof.rotation.y = base.rotation.y + Math.PI / 4;
      houses.add(base, roof);
    }
  }
  group.add(houses);
}

export function buildRunway(f) {
  const g = new THREE.Group();
  const len = f.length, wid = 26;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(wid, 0.6, len),
    new THREE.MeshStandardMaterial({ color: 0x4a4d52, flatShading: true, roughness: 1 }),
  );
  strip.position.y = 0.3;
  g.add(strip);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (const end of [-1, 1]) {
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 9), markMat);
      bar.position.set(i * 4.4, 0.68, end * (len / 2 - 12));
      g.add(bar);
    }
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, len * 0.7), markMat);
  dash.position.y = 0.66;
  g.add(dash);
  // Edge lights: small emissive posts the night approaches are flown by.
  const lightGeo = new THREE.SphereGeometry(0.9, 6, 5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, 24);
  const m = new THREE.Matrix4();
  let li = 0;
  for (let i = 0; i < 12; i++) {
    for (const side of [-1, 1]) {
      m.setPosition(side * (wid / 2 + 2.5), 1.1, -len / 2 + (i + 0.5) * (len / 12));
      lights.setMatrixAt(li++, m);
    }
  }
  g.add(lights);
  g.position.set(f.x, heightAt(f.x, f.z), f.z);
  g.rotation.y = Math.PI - f.heading;
  return g;
}

function buildLandmark(lm) {
  const g = new THREE.Group();
  const y = heightAt(lm.x, lm.z);
  if (lm.kind === 'lighthouse') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 26, 8), new THREE.MeshStandardMaterial({ color: 0xf0ead8, flatShading: true }));
    tower.position.y = 13;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.9, 6, 8), new THREE.MeshStandardMaterial({ color: 0xc23b2e, flatShading: true }));
    band.position.y = 17;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
    lamp.position.y = 28;
    g.add(tower, band, lamp);
  } else if (lm.kind === 'tower') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 44, 6), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, flatShading: true }));
    mast.position.y = 22;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 9), new THREE.MeshStandardMaterial({ color: 0xd8dee4, flatShading: true }));
    cab.position.y = 45;
    g.add(mast, cab);
  } else if (lm.kind === 'wreck') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 52), new THREE.MeshStandardMaterial({ color: 0x6e4a38, flatShading: true, roughness: 1 }));
    hull.position.y = 1;
    hull.rotation.z = 0.28;
    hull.rotation.y = 0.7;
    g.add(hull);
  }
  g.position.set(lm.x, y, lm.z);
  return g;
}

function buildClouds(group) {
  const rng = mulberry32(2024);
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  // Lambert with a strong emissive lift: a standard material under one
  // directional reads as dark rock, not cloud, at every time of day.
  const mat = new THREE.MeshLambertMaterial({ color: 0xf4f8ff, emissive: 0x8ea6bd, emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.95 });
  const clusters = [];
  for (let c = 0; c < 70; c++) {
    const cx = (rng() - 0.5) * WORLD.size * 1.05;
    const cz = (rng() - 0.5) * WORLD.size * 1.05;
    const cy = 820 + rng() * 560;
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) clusters.push({ x: cx, y: cy, z: cz, rng });
  }
  const puffs = new THREE.InstancedMesh(puffGeo, mat, clusters.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  clusters.forEach((c, i) => {
    const s = 42 + c.rng() * 80;
    const ox = (c.rng() - 0.5) * s * 1.5;
    const oz = (c.rng() - 0.5) * s * 1.1;
    const oy = (c.rng() - 0.5) * s * 0.22;
    e.set(0, c.rng() * Math.PI, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(c.x + ox, c.y + oy, c.z + oz), q, new THREE.Vector3(s, s * 0.32, s * (0.7 + c.rng() * 0.5)));
    puffs.setMatrixAt(i, m);
  });
  group.add(puffs);
}
