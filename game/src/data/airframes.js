// The hangar roster, from the design bible (Part C): four low-poly airframes
// with distinct silhouettes and honest numbers. stallSpeed/cruiseSpeed in
// m/s, fuel in litres, burn in L/h at cruise — burnPerSec applies the game's
// time compression (x8) so a sortie's fuel decision actually bites.

export const AIRFRAMES = [
  {
    id: 'wren', name: 'Kestrel K-2 Wren', role: 'STOL utility taildragger — lands anywhere at 21 m/s',
    price: 0, stallSpeed: 21, cruiseSpeed: 47, fuelCapacity: 180, cargoKg: 320, burnPerHour: 34,
    burnPerSec: (34 / 3600) * 8, thrust: 3.4, drag: 0.105,
    bodyLen: 9, wingSpan: 10.4, tail: 'standard', engines: 1, bodyColor: 0xe4e0d2, accentColor: 0xe2703a,
  },
  {
    id: 'marlin', name: 'Skiff S-4 Marlin', role: 'Amphibious surveyor — boat hull, camera rig, lagoon manners',
    price: 9000, stallSpeed: 24, cruiseSpeed: 52, fuelCapacity: 340, cargoKg: 480, burnPerHour: 58,
    burnPerSec: (58 / 3600) * 8, thrust: 3.6, drag: 0.11,
    bodyLen: 10.5, wingSpan: 13.2, tail: 'standard', engines: 1, bodyColor: 0xd9c79a, accentColor: 0x3c6e6a,
  },
  {
    id: 'pike', name: 'Halberd T-6 Pike', role: 'Twin turboprop — the fast medevac and the long legs',
    price: 26000, stallSpeed: 31, cruiseSpeed: 92, fuelCapacity: 1150, cargoKg: 1900, burnPerHour: 310,
    burnPerSec: (310 / 3600) * 8, thrust: 4.6, drag: 0.088,
    bodyLen: 19, wingSpan: 21.5, tail: 'standard', engines: 2, bodyColor: 0xe9e4d4, accentColor: 0xa5714b,
  },
  {
    id: 'mule', name: 'Anvil A-9 Mule', role: 'Heavy freighter — 4.2 t of campaign, if the strip allows it',
    price: 34000, stallSpeed: 33, cruiseSpeed: 78, fuelCapacity: 2400, cargoKg: 4200, burnPerHour: 620,
    burnPerSec: (620 / 3600) * 8, thrust: 4.4, drag: 0.13,
    bodyLen: 26, wingSpan: 30, tail: 'twin', engines: 2, bodyColor: 0x6b6a72, accentColor: 0xe2703a,
  },
];
