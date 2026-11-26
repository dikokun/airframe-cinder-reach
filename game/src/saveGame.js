// Career persistence in localStorage: credits, reputation, owned airframes
// and their upgrade tiers, per-airframe hull state, completed missions,
// medals and flight statistics. One versioned key; a corrupt save falls back
// to a fresh career rather than breaking the hangar.

const KEY = 'v4-flight-career-v1';

export function freshCareer(startCredits) {
  return {
    credits: startCredits,
    reputation: 0,
    owned: ['wren'],
    activeAirframe: 'wren',
    upgrades: {}, // airframeId -> { lineId: tier }
    hull: {}, // airframeId -> damage 0..100 carried between sorties
    fuelOnBoard: {}, // airframeId -> litres left in the tanks
    completed: {}, // missionId -> best grade
    medals: [],
    stats: { flights: 0, landings: 0, feather: 0, crashes: 0, earned: 0 },
  };
}

export function loadCareer(startCredits) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshCareer(startCredits);
    const data = JSON.parse(raw);
    if (!data || typeof data.credits !== 'number') return freshCareer(startCredits);
    return Object.assign(freshCareer(startCredits), data);
  } catch {
    return freshCareer(startCredits);
  }
}

export function storeCareer(career) {
  try {
    localStorage.setItem(KEY, JSON.stringify(career));
  } catch {
    // Private mode / quota: the career simply lives for the session.
  }
}
