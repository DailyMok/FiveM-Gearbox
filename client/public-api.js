(function (root) {
  'use strict';
  function create(api, controller, emitState, canChangeMode = () => false) {
    let last = -Infinity, previous = null;

    function state() {
      const vehicle = api.driverVehicle(), exists = !!vehicle && api.exists(vehicle);
      const model = exists ? root.StandaloneGearboxSettings.hash(api.model(vehicle)) : null;
      const record = controller.records.get(vehicle);
      const controlled = exists && api.controlled(vehicle);
      const owned = controlled && record?.phase === 'active'
        && root.StandaloneGearboxSettings.hash(record.model) === model;
      let sample = null;
      try { if (exists) sample = api.read(vehicle); } catch (_) {}
      const active = owned && !record.directionTransition
        && sample?.current === 1 && sample?.next === 1 && sample?.high === 1;
      const reverse = owned && sample?.current === 0 && sample?.engineRunning;
      return {
        apiVersion: 1, vehicle: exists ? vehicle : 0, model,
        active: !!active, canChangeMode: !!owned && canChangeMode() === true,
        controlled: !!controlled, phase: record?.phase || controller.status.phase,
        gear: reverse ? 'R' : active ? record.selected : null,
        gearCount: owned ? record.table.length : 0,
        mode: owned ? controller.mode : null,
        speedKmh: Number.isFinite(sample?.speedMps) ? sample.speedMps * 3.6 : 0,
        shifting: !!owned && !!record.pending, targetGear: owned ? record.pending?.target ?? null : null,
        strategy: owned ? record.profile?.strategy ?? null : null,
        displayGear: reverse ? 'R' : active
          ? record.profile.strategy === 'cvt' && controller.mode === 'auto' ? 'D' : record.selected : null,
        effectiveCapKmh: active && controller.config.limiter.enabled && record.backend === 'ratio'
          && record.selected < record.table.length ? record.caps[record.selected - 1] : null
      };
    }

    return {
      state,
      tick() {
        const now = api.now();
        if (now >= last && now - last < 100) return;
        last = now;
        const value = state(), encoded = JSON.stringify(value);
        if (encoded !== previous) {
          previous = encoded;
          try { emitState(value); } catch (_) {}
        }
      },
      stop() {
        previous = null;
        try {
          emitState({
            apiVersion: 1, vehicle: 0, model: null, active: false, canChangeMode: false,
            controlled: false, phase: 'stopped', gear: null, gearCount: 0, mode: null,
            speedKmh: 0, shifting: false, targetGear: null, strategy: null,
            displayGear: null, effectiveCapKmh: null
          });
        } catch (_) {}
      }
    };
  }
  root.StandaloneGearboxPublicApi = { create };
})(globalThis);
