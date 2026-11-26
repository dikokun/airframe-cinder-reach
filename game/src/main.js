// Conductor: scene, career flow, the sim loop and the staged-shot warp.
// One fixed-step simulation (120 Hz substeps of the 30 Hz frame) is shared
// by the player, the autopilot and the node harness — what flies in the
// browser is what was proven on the bench.

import * as THREE from '../vendor/three.module.min.js';
import { TIMES, ECONOMY } from './config.js';
import { AIRFRAMES } from './data/airframes.js';
import { CONTRACTS } from './data/contracts.js';
import { RADIO } from './data/radioLines.js';
import { fieldById, heightAt } from './data/zones.js';
import { buildWorld } from './terrain.js';
import { buildAircraft, poseAircraft } from './aircraftModel.js';
import { createPlane, stepPlane, applyDamage } from './flightModel.js';
import { createControls } from './controls.js';
import { createCameraRig } from './camera.js';
import { createWeather } from './weather.js';
import { createSortie, stepSortie, sortieTarget, clockText } from './missions.js';
import { buildSortieProps } from './sortieProps.js';
import { createAutopilot, autopilotInput, primeApproach } from './autopilot.js';
import { createHud } from './hud.js';
import { drawPanel } from './instruments.js';
import { createAudio } from './audio.js';
import { loadCareer, storeCareer } from './saveGame.js';
import { fitAirframe, rankIndex, checkMedals } from './career.js';
import { renderHangar, renderResults } from './screens.js';
import { mulberry32, pick } from './random.js';
import { SHOT_WARP_STEPS, shotConfig, shotContract, applyShotSpawn, shotFrozen } from './shotDirector.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1);
const rng = mulberry32(seed);
const shotName = params.get('shot');
const autoMode = params.get('auto') === '1' || !!shotName;

const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 24000);
const rig = createCameraRig(camera);

const career = loadCareer(ECONOMY.startCredits);
const audio = createAudio();
const hud = createHud();
const controls = createControls();
const screen = document.getElementById('screen');
const panel = document.getElementById('panel');

let world = null;
let plane = null;
let planeModel = null;
let sortie = null;
let props = null;
let weather = null;
let ap = null;
let simT = 0;
let frozen = false;
let lastTouchSeverity = 0;
let radioTimer = 0;

function setMood(timeKey) {
  const mood = TIMES[timeKey] ?? TIMES.day;
  scene.background = new THREE.Color(mood.sky);
  scene.fog = new THREE.Fog(mood.fog, mood.fogNear, mood.fogFar);
  scene.children.filter((c) => c.isLight).forEach((c) => scene.remove(c));
  const amb = new THREE.HemisphereLight(mood.sky, 0x4a5a44, mood.amb);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(mood.sun, mood.sunI);
  sun.position.set(-3500, 4200, -2600);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, mood.fill);
  fill.position.set(3200, 1800, 3400);
  scene.add(fill);
  if (weather) weather.applyFog(scene, timeKey);
}

function sayRadio(kind) {
  const pool = RADIO[kind];
  if (pool && pool.length) hud.say(pick(rng, pool));
  radioTimer = 6;
}

function showHangar() {
  screen.classList.add('open');
  renderHangar(screen, career, {
    select(id) { career.activeAirframe = id; storeCareer(career); audio.click(); showHangar(); },
    buy(id) {
      const a = AIRFRAMES.find((x) => x.id === id);
      if (a && career.credits >= a.price) {
        career.credits -= a.price;
        career.owned.push(id);
        career.activeAirframe = id;
        storeCareer(career);
        audio.cash();
        showHangar();
      }
    },
    upgrade(id) { upgradeFlow(id); },
    fly(id) { startSortie(CONTRACTS.find((c) => c.id === id)); },
  });
}

function upgradeFlow(airframeId) {
  // Simple one-click upgrade: buy the cheapest next tier across lines.
  import('./data/careerData.js').then(({ UPGRADES }) => {
    import('./career.js').then(({ upgradeTier, upgradeCost }) => {
      let best = null;
      for (const line of UPGRADES) {
        const t = upgradeTier(career, airframeId, line.id);
        if (t < 3) {
          const cost = upgradeCost(line.id, t + 1);
          if (!best || cost < best.cost) best = { line, t, cost };
        }
      }
      if (best && career.credits >= best.cost) {
        career.credits -= best.cost;
        career.upgrades[airframeId] = career.upgrades[airframeId] ?? {};
        career.upgrades[airframeId][best.line.id] = best.t + 1;
        storeCareer(career);
        audio.cash();
      }
      showHangar();
    });
  });
}

function startSortie(contract) {
  if (!contract) return;
  screen.classList.remove('open');
  // Contract sorties assign the airframe (the bible's fiction: you fly what
  // the hangar gives you); upgrades apply when the frame is owned.
  const base = AIRFRAMES.find((a) => a.id === (contract.airframe ?? career.activeAirframe)) ?? AIRFRAMES[0];
  const spec = fitAirframe(base, career);
  // Cargo loads cost climb and stall margin.
  if (contract.setup?.cargoKg && base.cargoKg) {
    const frac = Math.min(1, contract.setup.cargoKg / base.cargoKg);
    spec.thrust *= 1 - frac * 0.16;
    spec.stallSpeed *= 1 + frac * 0.06;
  }
  const from = fieldById(contract.from);
  const gy = heightAt(from.x, from.z);
  plane = createPlane(spec, {
    x: from.x - Math.sin(from.heading) * from.length * 0.36,
    z: from.z + Math.cos(from.heading) * from.length * 0.36,
    y: gy,
    heading: from.heading,
    onGround: true,
    fuel: Math.round(spec.fuelCapacity * (contract.setup?.fuelPct ?? 1)),
    damage: career.hull[base.id] ?? 0,
  });
  weather = createWeather(contract.weather);
  sortie = createSortie(contract, plane, weather);
  sortie.startDamage = plane.damage;
  sortie.title = contract.name;
  sortie.objectiveHtml = (p) => objectiveHtml(sortie, p);
  sortie.clockText = (t) => clockText(sortie, t);
  ap = createAutopilot();
  simT = 0;
  frozen = false;
  lastTouchSeverity = 0;

  if (planeModel) scene.remove(planeModel.group);
  planeModel = buildAircraft(base);
  scene.add(planeModel.group);
  if (props) props.dispose(scene);
  props = buildSortieProps(scene, sortie);
  setMood(contract.time);
  rig.setMode('chase');
  rig.snap(plane);
  sayRadio('depart');
}

function objectiveHtml(s, p) {
  const target = sortieTarget(s);
  const d = Math.round(Math.hypot(target.x - p.x, target.z - p.z));
  if (target.kind === 'gate') {
    return `Survey gate ${s.gateIdx + 1}/${s.gates.length} — <b>${d} m</b>, band ${Math.round(target.y)} m`;
  }
  const to = s.toField;
  return `Land at <b>${to.name}</b> — <b>${d} m</b>${s.contract.setup?.engineOutAt ? ' · emergency briefed' : ''}`;
}

function finishSortie() {
  const c = sortie.contract;
  career.stats.flights++;
  if (sortie.phase === 'done' && sortie.pay > 0) {
    career.credits += sortie.pay;
    career.reputation += c.rep;
    career.stats.earned += sortie.pay;
    if (!career.completed[c.id] || sortie.grade) career.completed[c.id] = sortie.grade?.label ?? 'DONE';
    audio.cash();
  } else if (sortie.phase === 'failed') {
    career.stats.crashes += sortie.plane.crashed ? 1 : 0;
    career.credits = Math.max(0, career.credits - ECONOMY.crashFine);
    audio.fail();
  }
  if (sortie.grade?.id === 'feather') career.stats.feather++;
  if (sortie.grade) career.stats.landings++;
  if (sortie.phase === 'done') {
    const st = career.stats;
    if (sortie.plane.fuel >= sortie.plane.spec.fuelCapacity * 0.25) st.reserveLandings = (st.reserveLandings ?? 0) + 1;
    if (sortie.plane.damage <= (sortie.startDamage ?? 0)) st.cleanContracts = (st.cleanContracts ?? 0) + 1;
    if (c.time === 'night') st.nightContracts = (st.nightContracts ?? 0) + 1;
    if (c.weather === 'crosswind') st.crosswindContracts = (st.crosswindContracts ?? 0) + 1;
    if (c.type === 'cargo') st.cargoContracts = (st.cargoContracts ?? 0) + 1;
  }
  career.hull[sortie.plane.spec.id] = Math.round(sortie.plane.damage);
  career.fuelOnBoard[sortie.plane.spec.id] = Math.round(sortie.plane.fuel);
  const earned = checkMedals(career, sortie);
  storeCareer(career);
  screen.classList.add('open');
  renderResults(screen, sortie, career, earned, { hangar: showHangar });
}

function stepOnce(dt) {
  if (!sortie || !plane || frozen) return;
  simT += dt;
  const input = autoMode && ap ? autopilotInput(ap, plane, sortie, dt) : controls.sample(dt);
  if (!autoMode) controls.state.throttle = input.throttle;
  const env = {
    groundY: heightAt(plane.x, plane.z),
    windX: weather.windX,
    windZ: weather.windZ,
    gust: weather.gustAt(simT),
  };
  const events = stepPlane(plane, input, dt, env);
  for (const ev of events) {
    if (ev.type === 'stall') audio.stall();
    if (ev.type === 'flameout') { audio.flameout(); sayRadio('flameout'); }
    if (ev.type === 'touchdown') {
      lastTouchSeverity = ev.severity;
      const dmg = Math.max(0, ev.severity - 2.4) * (plane.gearDown ? 5 : 9);
      if (dmg > 0) applyDamage(plane, dmg, events, 'touchdown');
      audio.touchdown(ev.severity < 3.2);
      if (ev.severity > 5) rig.addShake(0.5);
    }
    if (ev.type === 'crash') { audio.scrape(); rig.addShake(1); }
  }
  const before = sortie.messages.length;
  stepSortie(sortie, events, dt);
  for (let i = before; i < sortie.messages.length; i++) {
    const m = sortie.messages[i];
    if (m === 'engineout') { audio.flameout(); sayRadio('engineout'); }
    if (m === 'gate') sayRadio('gate');
  }
  if ((sortie.phase === 'done' || sortie.phase === 'failed') && !sortie.reported) {
    sortie.reported = true;
    setTimeout(finishSortie, 900);
  }
  if (shotName && shotFrozen(shotName, sortie, plane, simT)) frozen = true;
}

function frame() {
  requestAnimationFrame(frame);
  const dt = 1 / 30;
  if (shotName && !frozen) {
    for (let i = 0; i < SHOT_WARP_STEPS; i++) stepOnce(1 / 30);
  } else {
    stepOnce(dt); stepOnce(dt);
  }
  if (plane && planeModel) {
    poseAircraft(planeModel.group, plane);
    planeModel.update(plane, simT);
    // In shot mode the sim warps 45 steps per frame; the camera must snap
    // to its mark or it trails hundreds of metres behind the aeroplane.
    rig.update(plane, shotName ? 10 : dt, simT);
    hud.update(plane, sortie, simT);
    audio.update(plane, dt);
    if (props) props.update(simT);
    panel.style.display = rig.mode === 'cockpit' ? 'block' : 'none';
    document.body.classList.toggle('cockpit-on', rig.mode === 'cockpit');
    planeModel.setPropDetail(rig.mode !== 'cockpit');
    if (rig.mode === 'cockpit') drawPanel(panel, plane, sortie);
    if (radioTimer > 0) { radioTimer -= dt; if (radioTimer <= 0) hud.say(''); }
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'c' && plane) {
    rig.setMode(rig.mode === 'chase' ? 'cockpit' : 'chase');
    audio.unlock();
  }
  audio.unlock();
});

// Boot: world first (mood follows the first sortie or the hangar shot).
setMood('day');
world = buildWorld(scene);
scene.add(world);

if (shotName === 'hangar') {
  showHangar();
} else if (shotName) {
  const contract = shotContract(shotName);
  startSortie(contract);
  applyShotSpawn(shotName, plane, sortie);
  if (shotName !== 'emergency') primeApproach(ap);
  rig.setMode(sortie.shotCamera ?? 'chase');
  rig.snap(plane);
} else if (params.get('fly')) {
  startSortie(CONTRACTS.find((c) => c.id === params.get('fly')) ?? CONTRACTS[0]);
} else {
  showHangar();
}
frame();
