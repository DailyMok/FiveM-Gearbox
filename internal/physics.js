// Internal mechanics: retained from 0.2.15. Use config.js for server administration.
globalThis.StandaloneGearboxPhysics = {
  enabled: true,
  defaultMode: 'auto',
  profileRevision: 'v1',
  stateKey: 'standalone_gearbox:v1',
  referenceKey: 'standalone_gearbox:reference:v1',
  command: 'sgbox',
  upKey: 'PAGEUP',
  downKey: 'PAGEDOWN',
  showHud: true,
  debug: false,
  logFinalTransitions: true,
  defaultCarGears: { thresholdKmh: 160, slow: 5, fast: 6 },
  // Native estimated speed is not measured Vmax. Sports/super classes must not
  // be classified as slow cars solely by that estimate; explicit profiles win.
  sportCarMinGears: 6,
  motorcycleGears: 6,
  heavyTruckGears: 12,
  heavyVehicleGears: 6,
  industrialGears: 6,
  quadGears: 5,
  cvtPositions: 6,
  singleRatioSpread: 3.2,
  // Physical RPM range, not synthetic audio. Caps are built BEFORE this factor.
  // Thermal stepped intermediates only; 1 restores the 0.2.2 ratios.
  intermediateRpmFactor: 1.25,
  cvt: { targetRpm: 0.78, updateMs: 100, ratePerSecond: 0.9 },
  // Source: native gear APIs currently operate on GTA's finite native table.
  // Logical gears are independent: 12 logical gears still use only native gear 1.
  maxNativeGears: 10,
  maxLogicalGears: 24,
  stationaryMps: 0.4,
  entryMaxMps: 2,
  shiftFeedback: { enabled: false, volume: 0.22387211385683395 },
  shift: { cutMs: 200, commitMs: 40, cooldownMs: 200, maxGapMs: 500,
    maxDownshiftRpm: 0.98, autoDownshiftMarginKmh: 10, autoUpshiftHysteresisKmh: 1, upRpm: 0.92,
    minAutoThrottle: 0.10, capFraction: 0.985, maxAutoSlip: 0.25, minRpmUpshiftCapFraction: 0.25, minRollingMps: 1 },
  capRpm: { enabled: true, target: 0.98, startFraction: 0.97 },
  limiter: { enabled: true, entryMarginKmh: 1, exitMarginKmh: 3,
    holdMs: 40, periodMs: 90, cutMs: 30 },
  // Test calibration: actual wheel brake pressure, no handling/traction mutation.
  engineBrake: { enabled: true, lockEnabled: true, lockRelativeExcess: 0.25, maxPressure: 6, pressurePerRelativeExcess: 6,
    entryKmh: 1, risePerSecond: 8, risePerRelativeExcess: 52, fallPerSecond: 20, updateMs: 100,
    observeThrottle: 0.15, observeMinSpeedMps: 1, powerEpsilon: 0.001,
    observeSamples: 3, observeSpacingMs: 50, observeMinMs: 100 },
  recovery: { scanMs: 1000, maxRestoreRpm: 1.02 },
  // Optional resource names. If one is running, native handover precedes suspension.
  conflictingResources: [],
  // Model entries here override the supplied catalogue. Keys: lowercase spawn names.
  // Example: omnis: { gears: 4, family: 'car', reason: 'Server gameplay choice' }
  // No real-world equivalence is implied by an example.
  modelOverrides: {}
};
