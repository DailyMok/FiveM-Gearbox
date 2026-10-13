// OPTIONAL VEHICLE EXCEPTIONS
// Leave this object empty for automatic coverage by vehicle type and class.
// Add only models that need a server-specific exception; this is not a vehicle catalogue.
// Keys: spawn name OR signed/unsigned decimal model hash. Use one key per model.
// Conflicting aliases for the same hash disable that model until corrected.
// Restart the resource after changes. See docs/ADMIN-CONFIG.md for advanced fields.

globalThis.StandaloneGearboxVehicleProfiles = {
  // Disable this resource for one vehicle (keep its native/other gearbox):
  // adder: { enabled: false },

  // Use Sequential by default for one vehicle:
  // '3078201489': { defaultMode: 'seq' }, // Adder hash; do not also add 'adder'.

  // Optional gameplay gear count override (1–24):
  // omnis: { gears: 4 },

  // If config.js uses vehicles: 'selected', explicitly enable chosen models:
  // sultan: { enabled: true, defaultMode: 'auto' }
};
