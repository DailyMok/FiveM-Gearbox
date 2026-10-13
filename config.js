// STANDALONE GEARBOX — GENERAL SETTINGS
// Edit this file, then restart standalone_gearbox. No build step is required.
// Vehicle exceptions: vehicle-profiles.js | Player access: server/permissions.js
// This file is downloaded by players. Never put identifiers or secrets here.

globalThis.StandaloneGearboxAdmin = {
  enabled: true,                 // Enable the gearbox resource.
  locale: 'en',                  // Player language: 'en' or 'fr'.
  hud: true,                     // Show the included HUD. External HUD exports stay available.

  // VEHICLES
  // 'all': automatically handle supported vehicle classes, including add-ons.
  // No vehicle list is needed. Bicycles, trailers, boats, aircraft and trains stay native.
  // 'selected': only models with enabled: true in vehicle-profiles.js.
  vehicles: 'all',
  defaultMode: 'auto',            // 'auto': this mod's automatic gearbox | 'seq': sequential.

  // PLAYER CONTROLS
  // false locks the default mode. true uses the rules in server/permissions.js
  // (everyone by default). Only the current driver can request a mode change.
  allowModeSwitch: true,
  keys: {
    toggle: 'M',                 // Switch between Auto and Sequential.
    up: 'PAGEUP',                // Shift up in Sequential mode.
    down: 'PAGEDOWN'             // Shift down in Sequential mode.
  },
  // Initial defaults only: players can rebind all three in Settings > Key Bindings > FiveM.
  // Changing these defaults does not replace a player's saved bindings.
  command: 'sgbox',              // /sgbox auto | seq | toggle | up | down | info

  // OPTIONAL SHIFT SOUNDS (engine audio remains native)
  shiftSounds: {
    enabled: false,
    volume: 100                  // 0–100. Maximum playback gain is 30% of the audio file.
  },

  // ADVANCED INTEGRATION — normally leave both lists empty.
  conflictingResources: [],      // Pause this gearbox while any named resource is running.
  trustedResources: []           // Resource names allowed to use maintenance exports; not players.
};
