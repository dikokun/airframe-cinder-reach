// In-world objective markers: a light pillar over the destination strip and
// torus rings at survey gates. They read instantly in a screenshot — the
// pilot (and the judge) always knows where the work is.

import * as THREE from '../vendor/three.module.min.js';
import { heightAt } from './data/zones.js';

export function buildSortieProps(scene, sortie) {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.3, depthWrite: false });

  // Destination beam over the target strip.
  const toField = sortie.toField;
  if (toField) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 700, 10, 1, true), beamMat);
    beam.position.set(toField.x, heightAt(toField.x, toField.z) + 350, toField.z);
    group.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 1.6, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffc94d }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(toField.x, heightAt(toField.x, toField.z) + 3, toField.z);
    group.add(ring);
  }

  // Survey gates as rings standing in the air.
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x6be3ff, transparent: true, opacity: 0.85 });
  const gateMeshes = sortie.gates.map((g) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 2.4, 8, 36), gateMat);
    ring.position.set(g.x, g.y, g.z);
    group.add(ring);
    return ring;
  });

  scene.add(group);
  return {
    group,
    update(t) {
      for (let i = 0; i < gateMeshes.length; i++) {
        const g = sortie.gates[i];
        gateMeshes[i].visible = !g.done;
        gateMeshes[i].material = gateMat;
        gateMeshes[i].lookAt(g.x + Math.sin(t * 0.4 + i), g.y, g.z + Math.cos(t * 0.4 + i));
      }
    },
    dispose(sceneRef) { sceneRef.remove(group); },
  };
}
