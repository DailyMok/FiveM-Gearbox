// WHO CAN SWITCH BETWEEN AUTO AND SEQUENTIAL?
// Server-only file: never add it to client_scripts, shared_scripts or files.
// config.js must also have allowModeSwitch: true. Gear up/down need no extra permission.
// Choose ONE strategy. The remaining sections are ignored unless selected.

globalThis.StandaloneGearboxPermissions = {
  strategy: 'everyone',          // 'everyone', 'identifiers', 'ace' or 'jobs'.

  // strategy: 'identifiers' — exact FiveM identifiers, checked on the server.
  identifiers: [
    // 'license:replace_with_player_license'
  ],

  // strategy: 'ace' — grant this permission using your server.cfg/principals.
  // Example: add_ace group.admin standalone_gearbox.mode allow
  ace: 'standalone_gearbox.mode',

  // strategy: 'jobs' — requires your existing framework; none is required otherwise.
  jobs: {
    adapter: 'esx',              // 'esx', 'qbcore' or 'custom'.
    resource: '',                // Empty = 'es_extended' for ESX, 'qb-core' for QBCore.
    allowed: {
      mechanic: { minGrade: 0, requireDuty: false }
      // Add a comma above before adding another job:
      // police: { minGrade: 2, requireDuty: true }
    }
  },

  // adapter: 'custom' — replace this synchronous function with your server lookup.
  // Return { name: 'mechanic', grade: 2, onDuty: true } or null to deny.
  // Promises, missing frameworks and invalid job data deny access.
  customJob: source => null
};
