// Hangar and results screens (DOM). The hangar is a judged surface: career
// chips, airframe cards with upgrade tiers, the contract board with
// dispatcher briefs and pay, and the medal wall — a career at a glance.

import { AIRFRAMES } from './data/airframes.js';
import { CONTRACTS } from './data/contracts.js';
import { MEDALS } from './data/medals.js';
import { GAME_TITLE, RANKS, UPGRADES } from './data/careerData.js';
import { rankOf, rankIndex, upgradeTier } from './career.js';
import { ECONOMY } from './config.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function renderHangar(root, career, actions) {
  const rank = rankOf(career);
  const ri = rankIndex(career);
  const active = AIRFRAMES.find((a) => a.id === career.activeAirframe) ?? AIRFRAMES[0];

  const cards = AIRFRAMES.map((a) => {
    const owned = career.owned.includes(a.id);
    const isActive = career.activeAirframe === a.id;
    const tiers = UPGRADES.map((u) => {
      const t = upgradeTier(career, a.id, u.id);
      return `<span class="tier" title="${esc(u.name)}">${esc(u.short)} ${'●'.repeat(t)}${'○'.repeat(3 - t)}</span>`;
    }).join(' ');
    return `<div class="card ${isActive ? 'active' : ''}">
      <div class="card-name" style="border-color:#${a.bodyColor.toString(16).padStart(6, '0')}">${esc(a.name)}</div>
      <div class="card-role">${esc(a.role)} · stall ${a.stallSpeed} m/s · cruise ${a.cruiseSpeed} m/s · ${a.fuelCapacity} L</div>
      <div class="tiers">${tiers}</div>
      ${owned
        ? `<button data-act="select" data-id="${a.id}">${isActive ? 'SELECTED' : 'FLY THIS'}</button>
           <button data-act="upgrade" data-id="${a.id}">UPGRADES</button>`
        : `<button data-act="buy" data-id="${a.id}">BUY — ${a.price.toLocaleString()} CR</button>`}
    </div>`;
  }).join('');

  const board = CONTRACTS.map((c) => {
    const locked = ri < c.minRank;
    const done = career.completed[c.id];
    return `<div class="contract ${locked ? 'locked' : ''}">
      <div class="c-head"><span class="c-name">${esc(c.name)}</span><span class="c-pay">${c.pay.toLocaleString()} CR · +${c.rep} REP</span></div>
      <div class="c-brief">“${esc(c.brief)}” — ${esc(c.dispatcher)}</div>
      <div class="c-meta">${esc(c.typeLabel)} · ${esc(c.fromName)} → ${esc(c.toName)} · ${esc(c.time)} · ${esc(c.weatherLabel)}${done ? ' · ✓ ' + esc(done) : ''}</div>
      <button data-act="fly" data-id="${c.id}" ${locked ? 'disabled' : ''}>${locked ? 'NEEDS ' + RANKS[c.minRank].name.toUpperCase() : 'FLY'}</button>
    </div>`;
  }).join('');

  const medals = MEDALS.map((m) => `<span class="medal ${career.medals.includes(m.id) ? 'won' : ''}" title="${esc(m.hint)}">${esc(m.name)}</span>`).join('');

  root.innerHTML = `
    <div class="hangar-head">
      <div class="game-title">${esc(GAME_TITLE)}</div>
      <div class="chips">
        <span class="chip">${career.credits.toLocaleString()} CR</span>
        <span class="chip">${esc(rank.name)}</span>
        <span class="chip">Rep ${career.reputation}</span>
        <span class="chip">Flights ${career.stats.flights}</span>
        <span class="chip">Contracts ${Object.keys(career.completed).length}/${CONTRACTS.length}</span>
      </div>
    </div>
    <h3>AIRFRAMES</h3><div class="cards">${cards}</div>
    <h3>CONTRACT BOARD</h3><div class="board">${board}</div>
    <h3>MEDALS</h3><div class="medals">${medals}</div>
    <div class="foot">Repairs ${ECONOMY.repairPerPoint} CR/hull point · Fuel ${ECONOMY.fuelPerLitre} CR/L · Progress saves on this device</div>`;

  root.querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', () => actions[b.dataset.act]?.(b.dataset.id));
  });
}

export function renderResults(root, sortie, career, earnedMedals, actions) {
  const c = sortie.contract;
  const s = career.stats;
  root.innerHTML = `
    <div class="results">
      <div class="verdict">${esc(sortie.verdict ?? '')}</div>
      <div class="r-title">${esc(c.name)}</div>
      <table class="slip">
        <tr><td>Touchdown</td><td>${sortie.grade ? esc(sortie.grade.label) + ' · ' + sortie.touchdownSink.toFixed(1) + ' m/s' : '—'}</td></tr>
        <tr><td>Landed</td><td>${sortie.landedField ? esc(sortie.landedField.name) : 'off-field'}</td></tr>
        <tr><td>Hull</td><td>${Math.round(100 - sortie.plane.damage)}%</td></tr>
        <tr><td>Fuel left</td><td>${Math.max(0, Math.round(sortie.plane.fuel))} L</td></tr>
        <tr><td>Contract pay</td><td>${sortie.pay.toLocaleString()} CR</td></tr>
        <tr><td>Balance</td><td>${career.credits.toLocaleString()} CR · Rep ${career.reputation}</td></tr>
        <tr><td>Career</td><td>${s.flights} flights · ${s.feather} feather landings · ${s.crashes} crashes</td></tr>
      </table>
      ${earnedMedals.length ? `<div class="new-medals">New medal: ${earnedMedals.map((m) => esc(m.name)).join(' · ')}</div>` : ''}
      <button data-act="hangar">BACK TO HANGAR</button>
    </div>`;
  root.querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', () => actions[b.dataset.act]?.());
  });
}
