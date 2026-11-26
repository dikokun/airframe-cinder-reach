// DOM HUD over the 3D view: SPD/ALT tapes, HDG strip, objective card with a
// live distance readout, fuel/hull/throttle meters, warning line and the
// dispatcher's radio line. Updated per frame from the plane + mission state.

import { clamp } from './random.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  const spd = el('hud-spd'), alt = el('hud-alt'), hdg = el('hud-hdg');
  const objTitle = el('hud-obj-title'), objBody = el('hud-obj-body');
  const fuelBar = el('hud-fuel'), hullBar = el('hud-hull'), thrBar = el('hud-thr');
  const warn = el('hud-warn'), radio = el('hud-radio'), clock = el('hud-clock');

  return {
    update(p, mission, t) {
      spd.textContent = Math.round(p.speed * 1.94);
      alt.textContent = Math.round(p.y);
      const deg = ((Math.round((p.heading * 180) / Math.PI) % 360) + 360) % 360;
      hdg.textContent = String(deg).padStart(3, '0') + '°';
      fuelBar.style.width = clamp((p.fuel / p.spec.fuelCapacity) * 100, 0, 100) + '%';
      fuelBar.style.background = p.fuel < p.spec.fuelCapacity * 0.2 ? '#e0483e' : '#43b581';
      hullBar.style.width = clamp(100 - p.damage, 0, 100) + '%';
      hullBar.style.background = p.damage > 55 ? '#e0483e' : '#d9a441';
      thrBar.style.width = Math.round(p.throttle * 100) + '%';
      clock.textContent = mission ? mission.clockText(t) : '';

      if (mission) {
        objTitle.textContent = mission.title;
        objBody.innerHTML = mission.objectiveHtml(p);
      }
      const flags = [];
      if (p.stalled) flags.push('STALL');
      if (p.engineOut) flags.push('ENGINE OUT — GLIDE');
      if (p.fuel <= 0.01 && !p.onGround) flags.push('TANKS DRY');
      if (p.damage > 70) flags.push('HULL CRITICAL');
      warn.textContent = flags.join(' · ');
      warn.style.opacity = flags.length ? '1' : '0';
    },
    say(text) {
      radio.textContent = text;
      radio.style.opacity = text ? '1' : '0';
    },
  };
}
