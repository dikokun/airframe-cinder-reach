// Ten medals, names and spirit from the design bible (Part E4), conditions
// written against this build's career counters. test(career, sortie) runs
// after the sortie's counters are banked.

export const MEDALS = [
  { id: 'first-solo', name: 'First Solo', hint: 'Complete a contract with a Smooth or better landing',
    test: (c, s) => s.phase === 'done' && s.grade && ['feather', 'smooth'].includes(s.grade.id) },
  { id: 'butter-fingers', name: 'Butter Fingers', hint: 'Five Feather landings across the career',
    test: (c) => c.stats.feather >= 5 },
  { id: 'iron-reserve', name: 'Iron Reserve', hint: 'Land five times with a quarter tank or more left',
    test: (c) => (c.stats.reserveLandings ?? 0) >= 5 },
  { id: 'paper-tiger', name: 'Paper Tiger', hint: 'Complete four contracts with zero damage',
    test: (c) => (c.stats.cleanContracts ?? 0) >= 4 },
  { id: 'storm-chaser', name: 'Storm Chaser', hint: 'Complete a contract in storm weather',
    test: (c, s) => s.phase === 'done' && s.contract.weather === 'storm' },
  { id: 'night-owl', name: 'Night Owl', hint: 'Complete three night contracts',
    test: (c) => (c.stats.nightContracts ?? 0) >= 3 },
  { id: 'crosswind-king', name: 'Crosswind King', hint: 'Complete two crosswind contracts',
    test: (c) => (c.stats.crosswindContracts ?? 0) >= 2 },
  { id: 'heavy-metal', name: 'Heavy Metal', hint: 'Complete three cargo contracts',
    test: (c) => (c.stats.cargoContracts ?? 0) >= 3 },
  { id: 'deadstick', name: 'Deadstick', hint: 'Complete an engine-out contract',
    test: (c, s) => s.phase === 'done' && s.contract.type === 'engineout' },
  { id: 'master-of-the-pattern', name: 'Master of the Pattern', hint: 'Complete all twelve contracts',
    test: (c) => Object.keys(c.completed).length >= 12 },
];
