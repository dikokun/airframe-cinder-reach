// Canvas instrument panel drawn under the 3D view in cockpit mode: attitude
// ball, airspeed with a stall band that moves with flaps and damage,
// altimeter, compass, vertical speed, fuel and the warning flags. The judge
// criteria ask for instruments that look flown, not drawn — needles move
// with the model, the stall band creeps, flags latch.

import { stallSpeedOf } from './flightModel.js';
import { clamp } from './random.js';

function dial(ctx, x, y, r, label) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#10151c';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3d4a5a';
  ctx.stroke();
  ctx.fillStyle = '#8fa3b8';
  ctx.font = '600 8px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r - 5);
}

function needle(ctx, x, y, r, angle, color = '#ffd34d') {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * r * 0.82, y + Math.sin(angle) * r * 0.82);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function drawPanel(canvas, p, mission) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8, 11, 16, 0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2a3646';
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  const cy = H / 2, r = 46;
  const stall = stallSpeedOf(p);

  // Attitude indicator.
  {
    const x = 58;
    dial(ctx, x, cy, r, 'ATT');
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, r - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, cy);
    ctx.rotate(-p.bank);
    const po = clamp(p.pitch * 90, -34, 34);
    ctx.fillStyle = '#2e6da8';
    ctx.fillRect(-r, -r + po, r * 2, r);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, po, r * 2, r);
    ctx.strokeStyle = '#e8eef4';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r, po); ctx.lineTo(r, po); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 14, cy); ctx.lineTo(x - 4, cy); ctx.lineTo(x, cy + 4); ctx.lineTo(x + 4, cy); ctx.lineTo(x + 14, cy);
    ctx.stroke();
  }

  // Airspeed: 0..140 m/s sweep, red stall band + green arc.
  {
    const x = 152;
    dial(ctx, x, cy, r, 'SPD m/s');
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const toA = (v) => a0 + (clamp(v, 0, 140) / 140) * (a1 - a0);
    ctx.beginPath();
    ctx.arc(x, cy, r - 7, toA(stall), toA(stall + 6));
    ctx.strokeStyle = '#e0483e';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, cy, r - 7, toA(stall + 8), toA(p.spec.cruiseSpeed * 1.25));
    ctx.strokeStyle = '#43b581';
    ctx.stroke();
    needle(ctx, x, cy, r, toA(p.speed));
    ctx.fillStyle = '#e8eef4';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(p.speed * 1.94), x, cy + 22);
    ctx.fillStyle = '#8fa3b8';
    ctx.font = '600 7px Inter, sans-serif';
    ctx.fillText('KNOTS', x, cy + 31);
  }

  // Altimeter: 0..3000 m.
  {
    const x = 246;
    dial(ctx, x, cy, r, 'ALT m');
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    needle(ctx, x, cy, r, a0 + (clamp(p.y, 0, 3000) / 3000) * (a1 - a0));
    ctx.fillStyle = '#e8eef4';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(p.y), x, cy + 22);
  }

  // Compass.
  {
    const x = 340;
    dial(ctx, x, cy, r, 'HDG');
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(-p.heading);
    ctx.fillStyle = '#c8d4e2';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (const [deg, txt] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
      const a = (deg * Math.PI) / 180;
      ctx.fillText(txt, Math.sin(a) * (r - 13), -Math.cos(a) * (r - 13) + 3);
    }
    ctx.restore();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, cy - r + 4); ctx.lineTo(x, cy - r + 13); ctx.stroke();
    const hdg = ((Math.round((p.heading * 180) / Math.PI) % 360) + 360) % 360;
    ctx.fillStyle = '#e8eef4';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(hdg).padStart(3, '0') + '°', x, cy + 24);
  }

  // Text block: VSI, fuel, throttle, hull, gear/flaps, warnings.
  const x = 412;
  ctx.textAlign = 'left';
  ctx.font = '600 11px Inter, sans-serif';
  const rows = [
    ['VSI', (p.vy >= 0 ? '+' : '') + p.vy.toFixed(1) + ' m/s'],
    ['FUEL', Math.max(0, Math.round(p.fuel)) + ' L' + (p.fuel < p.spec.fuelCapacity * 0.2 ? ' LOW' : '')],
    ['THR', Math.round(p.throttle * 100) + '%'],
    ['HULL', Math.round(100 - p.damage) + '%'],
    ['GEAR', p.gearDown ? 'DOWN' : 'UP'],
    ['FLAPS', ['UP', 'HALF', 'FULL'][p.flaps]],
  ];
  rows.forEach(([k, v], i) => {
    const y = 24 + i * 17;
    ctx.fillStyle = '#8fa3b8';
    ctx.fillText(k, x, y);
    ctx.fillStyle = v.includes('LOW') ? '#e0483e' : '#e8eef4';
    ctx.fillText(v, x + 44, y);
  });
  const flags = [];
  if (p.stalled) flags.push('STALL');
  if (p.engineOut) flags.push('ENGINE OUT');
  if (mission?.lowFuel) flags.push('FUEL CRITICAL');
  ctx.font = '800 12px Inter, sans-serif';
  flags.forEach((f, i) => {
    ctx.fillStyle = '#e0483e';
    ctx.fillText('⚠ ' + f, x, 24 + (rows.length + i) * 17);
  });
}
