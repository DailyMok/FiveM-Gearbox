(function (root) {
  'use strict';
  const L = root.StandaloneGearboxLogic;
  function view(sample, record, mode, config) {
    if (!L.validSample(sample) || !Number.isInteger(sample.current)) return null;
    const owned = record?.phase === 'active' && sample.high === 1;
    const active = owned && !record.manualRange && !record.directionTransition && sample.current === 1 && sample.next === 1 && sample.high === 1;
    const gear = owned && record.manualRange ? record.manualRange : sample.current === 0 ? (sample.engineRunning ? 'R' : 'N')
      : active ? record.profile.strategy === 'cvt' && mode === 'auto' ? 'D' : record.selected : sample.current;
    let hint = null;
    if (active && sample.engineRunning && !sample.inAir && sample.forwardMps >= 0 && !record.pending) {
      const speed = sample.speedMps * 3.6, cap = record.caps[record.selected - 1];
      const rolling = !record.wheels?.available || record.wheels.slip <= config.shift.maxAutoSlip;
      const rpmReady = sample.speedMps >= (config.shift.minRollingMps ?? 1)
        && L.shiftRpm(sample, record) >= (record.profile.upRpm ?? config.shift.upRpm)
        && (mode !== 'auto' || L.autoRpmUpshiftReady(sample, cap, config));
      const capReady = speed >= cap * config.shift.capFraction;
      if (record.selected > 1 && L.autoDownshiftReady(sample, record.caps[record.selected - 2], config)) hint = 'down';
      else if (record.selected < record.table.length && rolling && sample.brake < 0.05
        && (rpmReady || capReady)) hint = 'up';
      if (record.profile.strategy === 'cvt' && mode === 'auto') hint = null;
    }
    return {type:'gearboxHud',visible:true,speed:Math.round(sample.speedMps * 3.6),gear,
      mode:owned ? mode : 'native',shiftHint:hint};
  }
  function create(api, controller, config, send) {
    let lastAt = -Infinity, visible = false;
    const hide = () => { if (visible) send({type:'gearboxHud',visible:false}); visible = false; };
    return { hide, tick() {
      const now = api.now();
      if (now >= lastAt && now - lastAt < 100) return;
      lastAt = now;
      const vehicle = api.driverVehicle();
      if (!config.showHud || !config.enabled || !vehicle || controller.stopping || controller.suspensions.size
        || api.conflictingResource() || !api.exists(vehicle)) return hide();
      const facts = api.facts(vehicle);
      if (!L.landType(facts) || facts.classId === 13
        || controller.entryFor(facts)?.hideHud === true) return hide();
      const record = controller.records.get(vehicle), raw = api.read(vehicle);
      const sample = record?.phase === 'active' ? controller.capRpm.sample(record, raw) : raw;
      const data = view(sample, record, controller.mode, config);
      if (!data) return hide();
      send({ ...data, locale: config.locale, labels: root.StandaloneGearboxLocale.get(config.locale).hud }); visible = true;
    }};
  }
  root.StandaloneGearboxHud = { view, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.StandaloneGearboxHud;
})(globalThis);
