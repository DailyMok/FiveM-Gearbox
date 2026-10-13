(function (root) {
  'use strict';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const positive = value => finite(value) && value > 0;
  const near = (a, b) => finite(a) && finite(b) && Math.abs(a - b) <= Math.max(1e-5, Math.abs(b) * 0.002);
  const validRatios = ratios => Array.isArray(ratios) && ratios.length > 0 && ratios.every(value => positive(value) && value < 100)
    && ratios.every((value, i) => !i || value < ratios[i - 1]);
  const validNativeRatios = ratios => Array.isArray(ratios) && ratios.length > 0 && positive(ratios[0])
    && ratios.every(ratio => finite(ratio) && ratio >= 0 && ratio < 100);
  const landType = facts => [0, 3, 4, 5, 6, 7, 11].includes(facts.rawType)
    || ['automobile', 'bike', 'quadbike', 'amphibious_automobile', 'amphibious_quadbike', 'submarinecar'].includes(facts.type);
  const validSample = sample => sample && [sample.speedMps, sample.forwardMps, sample.rpm, sample.throttle, sample.brake].every(finite)
    && sample.speedMps >= 0 && sample.rpm >= 0 && sample.rpm <= 1.5;

  function resolveProfile(facts, entry, config) {
    const e = entry || {};
    if (e.passthrough === true) return { ...e, passthrough: true, reason: e.reason || 'model_passthrough' };
    if (facts.type === 'trailer' || facts.rawType === 2 || e.family === 'trailer')
      return { unsupported: true, reason: 'unpowered_trailer_no_drive_transmission' };
    if (facts.classId === 13 || facts.rawType === 12 || e.family === 'bicycle')
      return { unsupported: true, reason: 'pedal_drivetrain_no_native_motor_gearbox' };
    if (facts.type === 'train' || facts.rawType === 14)
      return { unsupported: true, reason: 'rail_traction_not_a_native_road_gearbox' };
    if (!landType(facts)) return { unsupported: true, reason: 'non_land_drivetrain' };
    const family = e.family || (facts.electric ? 'electric' : [3,7].includes(facts.rawType) ? 'quad'
      : facts.type === 'bike' || facts.rawType === 11 ? 'motorcycle'
        : facts.classId === 20 || facts.classId === 17 ? 'heavyVehicle'
          : [10,11,19].includes(facts.classId) ? 'industrial' : 'car');
    // Missing Vmax data cannot exclude a motorized vehicle. This classification
    // reference never imposes a performance limit, including on add-ons.
    const referenceKmh = positive(e.referenceKmh) ? e.referenceKmh : positive(facts.referenceKmh) ? facts.referenceKmh : 160;
    const fallbackCarGears = referenceKmh <= config.defaultCarGears.thresholdKmh ? config.defaultCarGears.slow : config.defaultCarGears.fast;
    const carGears = [6,7].includes(facts.classId) ? Math.max(fallbackCarGears, config.sportCarMinGears ?? 6) : fallbackCarGears;
    const gears = e.gears ?? (family === 'heavyTruck' ? config.heavyTruckGears
      : family === 'motorcycle' ? config.motorcycleGears
        : family === 'quad' || family === 'kart' ? config.quadGears
          : family === 'heavyVehicle' ? config.heavyVehicleGears
            : ['industrial','tracked','farm'].includes(family) ? config.industrialGears
              : family === 'scooter' ? config.cvtPositions
        : carGears);
    if (!Number.isInteger(gears) || gears < 1 || gears > config.maxLogicalGears)
      return { unsupported: true, reason: 'invalid_logical_gear_count' };
    return { ...e, family, gears, referenceKmh, passthrough: false,
      strategy: e.strategy || (family === 'scooter' ? 'cvt' : family === 'electric' ? 'electric_steps' : 'stepped'),
      source: Number.isInteger(e.gears) ? 'model' : family !== 'car' ? 'family' : 'reference_speed_fallback',
      confidence: e.confidence || 'gameplay_default', calibrated: false };
  }

  function buildTable(nativeRatios, count, spread = 3.2) {
    if (!validNativeRatios(nativeRatios) || !Number.isInteger(count) || count < 1 || count > 24) return null;
    if (count === 1) return [Math.min(...nativeRatios.filter(positive))];
    // Snapshot order remains untouched for restoration. Sort/deduplicate a
    // separate working table so bonus gears and missing (zero) slots are valid.
    let anchors = [...new Set(nativeRatios.filter(positive))].sort((a,b) => b-a);
    if (anchors.length === 1) anchors = [anchors[0] * Math.max(1.1, spread), anchors[0]];
    return Array.from({ length: count }, (_, i) => {
      const position = i * (anchors.length - 1) / (count - 1);
      const lo = Math.floor(position), hi = Math.min(anchors.length - 1, lo + 1);
      return Math.exp(Math.log(anchors[lo]) * (1 - position + lo) + Math.log(anchors[hi]) * (position - lo));
    });
  }

  function buildCaps(table, referenceKmh, explicit) {
    if (!validRatios(table) || !positive(referenceKmh)) return null;
    if (explicit !== undefined) return Array.isArray(explicit) && explicit.length === table.length
      && explicit.every(positive) && explicit.every((value, i) => !i || value > explicit[i - 1]) ? [...explicit] : null;
    // Nominal speed bands, not measured redline speeds. Tune a profile when necessary.
    return table.map(ratio => referenceKmh * table.at(-1) / ratio);
  }

  function rpmRangeTable(base, nativeRatios, profile, config) {
    const requested = profile.intermediateRpmFactor ?? config.intermediateRpmFactor ?? 1;
    // Never reinterpret an explicit calibrated ratio table, an electrical/mono
    // drivetrain, or a CVT. An invalid factor safely leaves the working table.
    const eligible = profile.strategy === 'stepped' && profile.family !== 'electric'
      && !profile.ratios && nativeRatios.filter(positive).length > 1;
    const factor = eligible && finite(requested) && requested >= 1 && requested <= 1.25 ? requested : 1;
    const factors = base.map((_, i) => i < base.length - 1 ? factor : 1);
    const table = base.map((ratio, i) => ratio * factors[i]);
    return validRatios(table) ? { table, factors } : { table: [...base], factors: base.map(() => 1) };
  }
  function shiftRpm(sample, record) {
    const factor = record.rpmRangeFactors?.[record.selected - 1] ?? 1;
    return (finite(sample.decisionRpm) ? sample.decisionRpm : sample.rpm) / factor;
  }

  const projectedRpm = (rpm, from, to) => finite(rpm) && positive(from) && positive(to) ? rpm * to / from : null;
  function autoDownshiftThreshold(cap, config) {
    if (!positive(cap)) return null;
    const margin = config.shift.autoDownshiftMarginKmh;
    return Math.max(0, cap - (finite(margin) && margin >= 0 ? margin : 10));
  }
  function autoDownshiftReady(sample, cap, config) {
    const threshold = autoDownshiftThreshold(cap, config);
    return threshold !== null && finite(sample.speedMps) && sample.speedMps >= 0
      && sample.speedMps * 3.6 <= threshold;
  }
  function autoRpmUpshiftReady(sample, cap, config) {
    const threshold = autoDownshiftThreshold(cap, config), band = config.shift.autoUpshiftHysteresisKmh;
    // A just-completed downshift cannot immediately bounce up on high RPM alone.
    return threshold !== null && finite(sample.speedMps)
      && sample.speedMps * 3.6 > threshold + (finite(band) && band >= 0 ? band : 1);
  }
  function downshiftAllowed(sample, from, to, cap, config) {
    // Remove only our tagged RPM echo; do not divide by the sound ratio factor.
    const rpm = finite(sample.decisionRpm) ? sample.decisionRpm : sample.rpm;
    const projected = projectedRpm(rpm, from, to);
    return finite(projected) && projected <= config.shift.maxDownshiftRpm
      && (!positive(cap) || sample.speedMps * 3.6 <= cap + config.limiter.exitMarginKmh);
  }
  function restoreGear(baseline, activeRatio, rpm, maxRpm) {
    if (!validNativeRatios(baseline) || !positive(activeRatio) || !finite(rpm)) return null;
    const candidates = baseline.map((ratio, i) => ({ gear: i + 1, ratio,
      projected: projectedRpm(rpm, activeRatio, ratio), distance: Math.abs(Math.log(ratio / activeRatio)) }));
    const safe = candidates.filter(candidate => positive(candidate.ratio) && candidate.projected <= maxRpm);
    return safe.sort((a, b) => a.distance - b.distance)[0]?.gear ?? null;
  }
  function finalNativeGear(baseline) {
    if (!validNativeRatios(baseline)) return null;
    const longest = Math.min(...baseline.filter(positive));
    // Keep the longest original physical ratio; prefer the later native slot
    // for duplicate ratios. No new speed or engine/handling limit is imposed.
    return baseline.lastIndexOf(longest) + 1;
  }
  function drivenWheels(wheels, forwardMps) {
    const driven = wheels.filter(wheel => wheel.powered === true || wheel.powered === 1);
    const valid = driven.length > 0 && driven.every(wheel => finite(wheel.speedMps)) && finite(forwardMps);
    return { indices: driven.map(wheel => wheel.index), available: valid,
      slip: valid ? Math.max(0, (Math.max(...driven.map(wheel => wheel.speedMps)) - Math.max(0, forwardMps)) / Math.max(3, Math.abs(forwardMps))) : null };
  }
  function limiter(previous, sample, cap, now, config) {
    const c = config.limiter;
    if (!c.enabled || !positive(cap) || !validSample(sample) || !sample.engineRunning || sample.throttle <= 0.001
      || sample.forwardMps < 0 || sample.inAir || !finite(now)
      || (finite(previous?.lastAt) && (now < previous.lastAt || now - previous.lastAt > config.shift.maxGapMs)))
      return { since: null, cutting: false, lastAt: now };
    const speed = sample.speedMps * 3.6;
    // A short rev-limit pulse alone can still accelerate through a ceiling.
    // Above it, remove the driver's propulsion continuously, including partial
    // throttle. Do not clamp velocity or manufacture wheel lock/engine braking.
    if (speed > cap) return { since: previous?.since ?? now, cutting: true, lastAt: now, reason: 'above_intermediate_cap' };
    if (sample.brake > 0.05) return { since: null, cutting: false, lastAt: now };
    if (speed < cap - c.exitMarginKmh) return { since: null, cutting: false, lastAt: now };
    const since = previous?.since ?? (speed >= cap - c.entryMarginKmh ? now : null);
    const elapsed = since === null ? -1 : now - since;
    return { since, cutting: elapsed >= c.holdMs && (elapsed - c.holdMs) % c.periodMs < c.cutMs, lastAt: now };
  }
  root.StandaloneGearboxLogic = { finite, positive, near, validRatios, validNativeRatios, landType, validSample, resolveProfile, buildTable, buildCaps,
    rpmRangeTable, shiftRpm, projectedRpm, downshiftAllowed, autoDownshiftThreshold, autoDownshiftReady, autoRpmUpshiftReady, restoreGear, finalNativeGear, drivenWheels, limiter };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.StandaloneGearboxLogic;
})(globalThis);
