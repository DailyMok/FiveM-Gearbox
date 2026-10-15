(function (root) {
  'use strict';
  const L = root.StandaloneGearboxLogic;
  const clone = value => JSON.parse(JSON.stringify(value));
  class Controller {
    constructor(api, config, profiles) {
      this.api = api; this.config = config; this.profiles = profiles;
      this.records = new Map(); this.blocked = new Map(); this.mode = config.defaultMode; this.vehicleModes = new Map();
      this.suspensions = new Set(); this.status = { phase: 'idle', reason: null };
      this.currentVehicle = 0; this.lastScan = -Infinity; this.serial = 0;
      this.instance = api.instanceId(); this.stopping = false;
      this.capRpm = new root.StandaloneGearboxCapRpm(api, config, record => this.publish(record));
      this.braking = new root.StandaloneGearboxWheelBrake(api, config, record => this.publish(record));
      this.manualRange = new root.StandaloneGearboxManualRange(this);
    }
    report(phase, reason, extra = {}) {
      if (this.status.phase !== phase || this.status.reason !== reason) this.api.log({ phase, reason, ...extra });
      this.status = { phase, reason, ...extra };
    }
    entryFor(facts) {
      return root.StandaloneGearboxSettings.entry(facts, this.config, this.profiles, root.StandaloneGearboxVehicleProfiles, this.api.hashModel);
    }
    vehicleMode(vehicle) {
      if (!vehicle || !this.api.exists(vehicle)) return this.config.defaultMode;
      const saved=this.vehicleModes.get(vehicle),model=this.api.model(vehicle);
      if(saved?.model===model)return saved.mode;
      const selected=this.entryFor(this.api.facts(vehicle))?.defaultMode;
      return ['auto','seq'].includes(selected)?selected:this.config.defaultMode;
    }
    validRecovery(value, vehicle) {
      const c = this.config;
      return value?.version === 1 && value.model === this.api.model(vehicle) && typeof value.token === 'string'
        && value.token.length <= 128 && Number.isInteger(value.high) && value.high >= 1 && value.high <= c.maxNativeGears
        && L.validNativeRatios(value.ratios) && value.ratios.length === value.high
        && value.ratios.every(ratio => ratio < 100) && L.positive(value.expectedRatio) && value.expectedRatio < 100
        && (value.backend == null || ['ratio', 'native_top', 'native_final'].includes(value.backend))
        && (value.previousRatio == null || (L.positive(value.previousRatio) && value.previousRatio < 100))
        && (value.rpmInfluenced == null || typeof value.rpmInfluenced === 'boolean')
        && L.positive(value.referenceKmh) && value.referenceKmh < 1500 && this.braking.valid(value.wheelBrake);
    }
    ledger(record) {
      return { version: 1, model: record.model, token: record.token, high: record.high,
        ratios: [...record.original], expectedRatio: record.expectedRatio, referenceKmh: record.referenceKmh,
        previousRatio: record.previousRatio ?? null,
        backend: record.backend || 'ratio', rpmInfluenced: !!record.rpmInfluenced, wheelBrake: this.braking.ledger(record),
        ownerInstance: this.instance, recovery: record.phase !== 'active', reason: record.reason || null };
    }
    publish(record) {
      return this.api.writeState(record.vehicle, this.ledger(record)) === true;
    }
    sameEntity(record) {
      if (!this.api.exists(record.vehicle) || this.api.model(record.vehicle) !== record.model) return false;
      const state = this.api.readState(record.vehicle);
      return state?.token === record.token;
    }
    capture(vehicle) {
      const c = this.config, api = this.api;
      const missing = api.missingCapabilities();
      if (missing.length) { this.report('unsupported', 'natives_missing', { missing }); return; }
      if (!api.controlled(vehicle) || !api.isDriver(vehicle)) { this.report('waiting', 'controlled_driver_required'); return; }
      const previous = api.readState(vehicle);
      if (previous) {
        if (!this.validRecovery(previous, vehicle)) { this.report('unsupported', 'invalid_recovery_state'); return; }
        this.adoptRecovery(vehicle, previous); return;
      }
      const facts = api.facts(vehicle), entry = this.entryFor(facts);
      const cached = api.reference(facts.model);
      const sharedReference = api.entityReference(vehicle);
      // Configuration takes priority; otherwise use a stable model reference.
      // Upgrades never change an already captured classification.
      facts.referenceKmh = entry?.referenceKmh ?? sharedReference?.referenceKmh ?? cached ?? facts.estimatedMaxKmh;
      const profile = L.resolveProfile(facts, entry, c);
      if (profile.passthrough) { this.report('passthrough', profile.reason, { family: profile.family }); return; }
      if (profile.unsupported) { this.report('unsupported', profile.reason, { coverage: 'mechanical_exception' }); return; }
      const s = api.read(vehicle);
      if (api.landMode && !api.landMode(vehicle, profile)) { this.report('waiting', 'non_land_mode'); return; }
      if (!L.validSample(s)) { this.report('unsupported', 'invalid_native_sample'); return; }
      if (!s.engineRunning || s.current !== 1 || s.next !== 1 || s.speedMps > c.entryMaxMps || s.forwardMps < 0 || s.brake > 0.05) {
        this.report('waiting', 'native_first_at_low_speed', { nativeGear: s.current }); return;
      }
      if (!Number.isInteger(s.high) || s.high < 1 || s.high > c.maxNativeGears) {
        this.report('unsupported', 'invalid_native_gear_capacity'); return;
      }
      const original = Array.from({ length: s.high }, (_, i) => api.ratio(vehicle, i + 1));
      if (profile.strategy === 'stepped' && new Set(original.filter(L.positive)).size === 1)
        profile.strategy = 'single_ratio_steps';
      const baseTable = profile.ratios ?? L.buildTable(original, profile.gears, profile.singleRatioSpread ?? c.singleRatioSpread);
      const caps = L.buildCaps(baseTable, profile.referenceKmh, profile.capsKmh);
      const ranged = L.validRatios(baseTable) ? L.rpmRangeTable(baseTable, original, profile, c) : null;
      const table = ranged?.table;
      if (!L.validNativeRatios(original) || !L.validRatios(table) || table.length !== profile.gears || !caps) {
        this.report('unsupported', 'native_transmission_data_unusable'); return;
      }
      const record = { vehicle, model: facts.model, modelName: facts.modelName, token: this.instance + ':' + (++this.serial), phase: 'active',
        backend: 'ratio',
        high: s.high, original, table: [...table], baseTable: [...baseTable], rpmRangeFactors: ranged.factors, caps, profile, referenceKmh: profile.referenceKmh,
        selected: 1, expectedRatio: table[0], previousRatio: original[0], pending: null, lastShift: -Infinity, lastTick: api.now(),
        lastThrottle: s.throttle, limiter: { since: null, cutting: false }, observed: s,
        motion: { atMs: api.now(), speedMps: s.speedMps, accelerationMps2: null } };
      // A retrievable recovery record must exist BEFORE the first physical write.
      if (!this.publish(record)) { this.report('unsupported', 'recovery_state_unavailable'); return; }
      api.saveReference(facts.model, profile.referenceKmh);
      api.writeEntityReference(vehicle, { model: facts.model, referenceKmh: profile.referenceKmh, revision: c.profileRevision });
      this.records.set(vehicle, record);
      api.setHigh(vehicle, 1);
      api.setRatio(vehicle, 1, table[0]);
      if (api.read(vehicle).high !== 1 || !L.near(api.ratio(vehicle, 1), table[0])) {
        this.release(record, 'entry_readback_failed'); return;
      }
      record.previousRatio = null; this.publish(record);
      this.report('active', null, { family: profile.family, logicalGears: profile.gears, source: profile.source });
    }
    adoptRecovery(vehicle, saved) {
      if (!this.api.controlled(vehicle)) return;
      const record = { vehicle, model: saved.model, token: saved.token, high: saved.high,
        original: [...saved.ratios], expectedRatio: saved.expectedRatio, referenceKmh: saved.referenceKmh,
        previousRatio: saved.previousRatio ?? null,
        backend: saved.backend || 'ratio',
        phase: 'restore_pending', reason: 'ownership_or_resource_recovery', pending: null };
      this.braking.adopt(record, saved.wheelBrake);
      this.records.set(vehicle, record);
      this.restore(record);
    }
    release(record, reason) {
      if(record.phase==='active') { try { this.api.stopShiftFeedback?.(); } catch (_) {} }
      this.capRpm.stop(record, reason);
      const changed = record.phase !== 'restore_pending' || record.reason !== reason || !!record.pending;
      record.phase = 'restore_pending'; record.reason = reason; record.pending = null;
      record.manualRange = null;
      if(changed&&this.api.now()-(record.lastReleaseTrace??-Infinity)>=5000){
        record.lastReleaseTrace=this.api.now();
        try{const sample=this.api.read(record.vehicle);this.api.log({phase:'transmission_release',model:record.modelName??null,
          reason,mode:this.mode,selected:record.selected??null,directionTransition:!!record.directionTransition,
          current:sample.current,next:sample.next,high:sample.high,speedKmh:sample.speedMps*3.6});}catch(_){}
      }
      if (changed && this.api.controlled(record.vehicle) && this.sameEntity(record)) this.publish(record);
      return this.restore(record);
    }
    restore(record) {
      const api = this.api, v = record.vehicle;
      if (!this.sameEntity(record)) { this.records.delete(v); return true; }
      if (!api.controlled(v)) { this.report('restore_pending', 'network_control_lost'); return false; }
      if (!this.braking.release(record, record.reason || 'gearbox_release')) { this.report('restore_pending', 'wheel_brake_release_pending'); return false; }
      // In the final native domain no transmission field belongs to us any more.
      // Do not restore stale values over a garage/other script's newer gearbox.
      if (['native_top', 'native_final'].includes(record.backend)) {
        if (!api.writeState(v, null)) { this.report('restore_pending', 'recovery_state_clear_failed'); return false; }
        this.records.delete(v); return true;
      }
      const s = api.read(v), ratio = api.ratio(v, 1), ours = L.near(ratio, record.expectedRatio) || L.near(ratio, record.previousRatio);
      if (!L.validSample(s)) { this.report('restore_pending', 'invalid_native_sample'); return false; }
      // A completed handover can precede its final journal acknowledgement.
      // Recognize the actual original transmission; slot 1 is NOT the engaged
      // native ratio and must never be used to force first while rolling.
      if (s.high === record.high && record.original.every((value, i) => L.near(api.ratio(v, i + 1), value))) {
        if (!api.writeState(v, null)) { this.report('restore_pending', 'recovery_state_clear_failed'); return false; }
        this.records.delete(v); return true;
      }
      // Do not overwrite a concurrent resource's new ratio. Restore only the
      // ceiling we still own; report conflict and require an explicit rearm.
      if (!ours && !L.near(ratio, record.original[0])) {
        if (s.high === 1) api.setHigh(v, record.high);
        if (api.read(v).high === 1 && record.high !== 1) { this.report('restore_pending', 'conflict_ceiling_readback'); return false; }
        this.blocked.set(v, record.model);
        api.writeState(v, null); this.records.delete(v);
        this.report('suspended', 'external_ratio_writer_preserved'); return true;
      }
      // If another writer rebuilt the whole table, leave its new gear ceiling.
      // The first ratio remains ours only if it still matches expectedRatio.
      const restoreHigh = s.high === 1 || s.high === record.high;
      let target = null;
      if (s.speedMps > this.config.stationaryMps && s.current !== 0 && s.forwardMps >= 0 && ours) {
        // A partial native->custom handover may still be in native gear >1.
        // The modified first slot does not describe the engaged transmission.
        const engagedRatio = s.current > 1 ? api.ratio(v, s.current) : ratio;
        target = L.restoreGear(record.original, engagedRatio, s.rpm, this.config.recovery.maxRestoreRpm);
        if (!target || !restoreHigh) {
          this.report('restore_pending', target ? 'external_high_gear_writer' : 'no_safe_native_handover'); return false;
        }
      }
      if (api.isDriver(v)) api.cutThrottle();
      if (restoreHigh) api.setHigh(v, record.high);
      if (target !== null) {
        // Move off modified first before restoring its shorter original ratio.
        // Setters are required capabilities, and all four states are read back.
        api.setNext(v, target); api.setCurrent(v, target);
        const handover = api.read(v);
        if (handover.current !== target || handover.next !== target) {
          // Keep the ratio untouched when gear setters do not take effect.
          api.setHigh(v, 1);
          this.report('restore_pending', 'native_handover_readback_failed'); return false;
        }
      }
      if (ours || L.near(ratio, record.original[0])) api.setRatio(v, 1, record.original[0]);
      const after = api.read(v);
      if (!L.near(api.ratio(v, 1), record.original[0]) || (restoreHigh && after.high !== record.high)
        || (target !== null && (after.current !== target || after.next !== target))) {
        this.report('restore_pending', 'restore_readback_failed'); return false;
      }
      if (!api.writeState(v, null)) { this.report('restore_pending', 'recovery_state_clear_failed'); return false; }
      this.records.delete(v);
      this.report('native', 'restored', { rollingHandover: target !== null, nativeGear: target });
      return true;
    }
    physicalRatio(record, sample) {
      if (record.manualRange === 'N') return null;
      if (sample.current === 0) { const reverse = this.api.ratio(record.vehicle, 0); return L.finite(reverse) ? reverse : null; }
      return ['native_top', 'native_final'].includes(record.backend) ? this.api.ratio(record.vehicle, sample.current) : record.expectedRatio;
    }
    commitRatio(record, target, sample, forceForward = false) {
      const api = this.api, v = record.vehicle, ratio = record.table[target - 1];
      if (sample.high !== 1 || (!forceForward && (sample.current !== 1 || sample.next !== 1))) return false;
      const oldRatio = api.ratio(v, 1);
      const from = record.selected;
      record.previousRatio = oldRatio; record.expectedRatio = ratio;
      // Transaction journal advertises both possible first ratios before writing.
      record.backend = 'ratio';
      if (!this.publish(record)) { record.expectedRatio = oldRatio; return false; }
      api.setRatio(v, 1, ratio);
      if (forceForward) { api.setNext(v, 1); api.setCurrent(v, 1); }
      const after = api.read(v);
      if (after.current !== 1 || after.next !== 1 || after.high !== 1 || !L.near(api.ratio(v, 1), ratio)) return false;
      record.selected = target; record.previousRatio = null; this.publish(record);
      if (target === record.table.length) {
        const state = s => ({ current: s.current, next: s.next, high: s.high, rpm: s.rpm,
          speedKmh: s.speedMps * 3.6, clutch: L.finite(s.clutch) ? s.clutch : null,
          throttleOffset: L.finite(s.throttleOffset) ? s.throttleOffset : null, engineRunning: s.engineRunning });
        record.lastFinalTransition = { from, target, atMs: api.now(), ratioBefore: oldRatio, ratioAfter: ratio,
          before: state(sample), after: state(after), capKmh: null, backend: 'ratio',
          shiftCutPending: !!record.pending, shiftCutRemainingMs: record.pending ? Math.max(0, this.config.shift.cutMs - (api.now() - record.pending.at)) : 0,
          nativeBaselineHigh: record.high, nativeBaselineRatios: [...record.original] };
        if (this.config.logFinalTransitions && api.now() - (record.lastFinalLog ?? -Infinity) >= 5000) {
          api.log({ phase: 'final_ratio_transition', model: record.modelName, ...record.lastFinalTransition });
          record.lastFinalLog = api.now();
        }
      }
      return true;
    }
    updateDirection(record, sample, now) {
      const api=this.api,v=record.vehicle,c=this.config;
      const wantsReverse=sample.speedMps<=c.stationaryMps&&sample.brake>0.1&&sample.throttle<=0.05;
      const nativeTransition=sample.current===0||sample.next===0;
      if(!record.directionTransition&&!wantsReverse&&!nativeTransition)return false;
      if(!record.directionTransition){
        record.directionTransition={since:now,resetFirst:wantsReverse||sample.speedMps<=c.entryMaxMps||sample.forwardMps<0};
        record.pending=null;record.limiter={since:null,cutting:false};
        if(now-(record.lastDirectionTrace??-Infinity)>=5000){
          record.directionTransition.trace=true;record.lastDirectionTrace=now;api.log({phase:'direction_transition',stage:'enter',model:record.modelName,
            current:sample.current,next:sample.next,high:sample.high,speedKmh:sample.speedMps*3.6,resetFirst:record.directionTransition.resetFirst});
        }
      }
      this.capRpm.stop(record,'direction_transition');
      // Keep High=1 and the recovery journal. Native reverse uses its own slot;
      // releasing the whole gearbox here would allow an automatic upshift before
      // a fresh low-speed capture and permanently miss that capture window.
      if(!this.braking.release(record,'direction_transition')){
        this.report('active','direction_brake_restore_pending');return true;
      }
      const transition=record.directionTransition;
      const forwardReady=!wantsReverse&&sample.current===1&&sample.next===1&&sample.forwardMps>=0&&sample.brake<=0.05;
      if(!forwardReady){this.report('active','native_direction_transition');return true;}
      if(transition.resetFirst&&record.selected!==1){
        const before=record.expectedRatio,target=record.table[0];
        record.previousRatio=before;record.expectedRatio=target;
        if(!this.publish(record)){record.expectedRatio=before;record.previousRatio=null;this.report('active','direction_journal_pending');return true;}
        api.setRatio(v,1,target);
        if(!L.near(api.ratio(v,1),target)||api.read(v).high!==1){this.release(record,'direction_ratio_readback_failed');return true;}
        record.selected=1;record.previousRatio=null;this.publish(record);
      }
      // A transient 0/1 or 1/0 never changes controller mode and never forces
      // Current/Next. Resume on GTA's natural forward engagement, even if it
      // happens beyond the initial 2 m/s capture threshold.
      if(forwardReady){
        if(transition.trace)api.log({phase:'direction_transition',stage:'forward_resumed',model:record.modelName,
          current:sample.current,next:sample.next,high:sample.high,speedKmh:sample.speedMps*3.6,selected:record.selected});
        record.directionTransition=null;record.lastThrottle=sample.throttle;
        this.report('active','direction_forward_resumed');return false;
      }
      this.report('active','native_direction_transition');return true;
    }
    updateCvt(record, sample, now) {
      const api = this.api, config = this.config, c = config.cvt;
      if (now - (record.lastCvt ?? -Infinity) < c.updateMs || sample.inAir || sample.brake > 0.05 || sample.throttle < 0.1) return;
      if (record.wheels?.available && record.wheels.slip > config.shift.maxAutoSlip) return;
      const dt = Math.min(0.2, (now - (record.lastCvt ?? now - c.updateMs)) / 1000); record.lastCvt = now;
      const low = record.table.at(-1), high = record.table[0];
      const speedFraction = Math.max(0, Math.min(1, sample.speedMps * 3.6 / record.referenceKmh));
      // Ratio scheduling is not a speed cap. It also reaches the original final
      // drive on CVT/electric models whose native RPM signal is almost constant.
      const schedule = low + (high - low) * Math.pow(1 - speedFraction, 2);
      const rpmTarget = record.expectedRatio * c.targetRpm / Math.max(0.1, sample.rpm);
      const target = Math.max(low, Math.min(high, schedule, rpmTarget));
      const factor = Math.exp(c.ratePerSecond * dt);
      const next = Math.max(record.expectedRatio / factor, Math.min(record.expectedRatio * factor, target));
      if (next <= low * 1.015 || speedFraction >= 1) {
        if (!this.commitRatio(record, record.table.length, sample)) this.release(record, 'cvt_final_ratio_failed'); return;
      }
      if (L.near(next, record.expectedRatio)) return;
      const before = record.expectedRatio;
      record.previousRatio = before; record.expectedRatio = next;
      if (!this.publish(record)) { record.expectedRatio = before; this.release(record, 'cvt_recovery_publish_failed'); return; }
      api.setRatio(record.vehicle, 1, next);
      if (!L.near(api.ratio(record.vehicle, 1), next)) { this.release(record, 'cvt_ratio_readback_failed'); return; }
      record.selected = Math.min(record.table.length - 1, record.table.reduce((best, ratio, i) => Math.abs(Math.log(ratio/next)) < Math.abs(Math.log(record.table[best]/next)) ? i : best, 0) + 1);
      record.previousRatio = null; this.publish(record);
    }
    applyLimiter(record, sample, now) {
      // All lower logical gears have an active speed ceiling, estimated when
      // no explicit calibration exists. Only the final logical ratio is free.
      record.limiter = record.pending || record.selected === record.table.length
        ? { since: null, cutting: false }
        : L.limiter(record.limiter, sample, record.caps[record.selected - 1], now, this.config);
      if (record.limiter.cutting) this.api.cutThrottle();
    }
    tick() {
      if (this.stopping) return;
      const api = this.api, c = this.config, v = api.driverVehicle();
      if(v!==this.currentVehicle)this.mode=this.vehicleMode(v);
      this.currentVehicle = v;
      for(const [vehicle,saved] of this.vehicleModes)if(!api.exists(vehicle)||api.model(vehicle)!==saved.model)this.vehicleModes.delete(vehicle);
      for (const record of [...this.records.values()]) {
        if (!this.sameEntity(record)) { this.records.delete(record.vehicle); continue; }
        if (record.phase !== 'active') { this.restore(record); continue; }
        if (record.vehicle !== v || !api.controlled(record.vehicle) || !api.isDriver(record.vehicle))
          this.release(record, 'driver_vehicle_or_control_changed');
      }
      if (api.now() - this.lastScan >= c.recovery.scanMs) {
        this.lastScan = api.now();
        for (const candidate of api.recoveryVehicles()) {
          if (this.records.has(candidate) || !api.controlled(candidate)) continue;
          const saved = api.readState(candidate);
          if (this.validRecovery(saved, candidate)) this.adoptRecovery(candidate, saved);
        }
      }
      if (!v || !api.exists(v)) { if (!this.records.size) this.report('idle', null); return; }
      const conflict = api.conflictingResource();
      if (!c.enabled || this.mode === 'native' || this.suspensions.size || conflict) {
        const record = this.records.get(v);
        if (record) this.release(record, conflict ? 'conflicting_resource' : 'suspended');
        this.report('suspended', conflict || [...this.suspensions][0] || 'native_mode'); return;
      }
      if (this.blocked.get(v) === api.model(v)) { this.report('suspended', 'external_writer_rearm_required'); return; }
      const record = this.records.get(v);
      if (!record) { this.capture(v); return; }
      if (record.phase !== 'active') return;
      let s = this.capRpm.sample(record, api.read(v));
      const now = api.now(), gap = now - record.lastTick;
      record.lastTick = now; record.observed = s;
      record.observedRatio = this.physicalRatio(record, s);
      if (!L.validSample(s)) { this.release(record, 'invalid_native_sample'); return; }
      if (!s.engineRunning || gap < 0 || gap > c.shift.maxGapMs) { this.release(record, !s.engineRunning ? 'engine_stopped' : 'tick_gap'); return; }
      const elapsedMotion = now - (record.motion?.atMs ?? now);
      record.motion = { atMs: now, speedMps: s.speedMps, accelerationMps2: elapsedMotion > 0 && elapsedMotion <= c.shift.maxGapMs
        ? (s.speedMps - record.motion.speedMps) * 1000 / elapsedMotion : null };
      if (api.landMode && !api.landMode(v, record.profile)) { this.release(record, 'left_land_mode'); return; }
      const integrity = s.high === 1 && L.near(api.ratio(v, 1), record.expectedRatio);
      if (!integrity) {
        this.blocked.set(v, record.model); this.release(record, 'external_gearbox_writer'); return;
      }
      const wasRange = !!record.manualRange || !!record.pending?.range;
      if (this.manualRange.update(record, s, now)) return;
      if (wasRange) s = this.capRpm.sample(record, api.read(v));
      if (this.updateDirection(record, s, now)) return;
      if (s.current !== 1 || s.next !== 1) { this.release(record, 'native_first_not_held'); return; }
      if (this.mode === 'auto' && s.speedMps <= c.stationaryMps && s.throttle > 0.1 && record.lastThrottle <= 0.1 && record.selected !== 1 && !record.pending)
        this.requestShift(1 - record.selected, true);
      record.lastThrottle = s.throttle;
      record.wheels = L.drivenWheels(api.wheels(v), s.forwardMps);
      if (!record.pending && this.mode === 'auto' && record.profile.strategy === 'cvt' && record.selected < record.table.length) {
        this.updateCvt(record, s, now);
        if (record.phase !== 'active') return;
        this.applyLimiter(record, s, now);
        this.braking.update(record, s, now, this.mode);
        this.capRpm.update(record, s, now, this.mode);
        this.report('active', null, { family: record.profile.family, logicalGears: record.table.length, source: record.profile.source }); return;
      }
      if (record.pending) {
        const pending = record.pending, age = now - pending.at;
        if(age < c.shift.cutMs || !pending.committed) api.cutThrottle();
        pending.frames++;
        if (age < 0 || age > c.shift.maxGapMs) { this.release(record, 'shift_clock_gap'); return; }
        if (!pending.committed && age >= c.shift.commitMs && pending.frames >= 2) {
          const stationaryReset = pending.stationaryFirst && s.speedMps <= c.stationaryMps && Math.abs(s.forwardMps) <= c.stationaryMps;
          if (pending.automatic && pending.target < record.selected && !stationaryReset && !L.autoDownshiftReady(s, record.caps[pending.target - 1], c)) {
            record.pending = null; this.report('active', 'downshift_recheck_rejected'); return;
          }
          const from = record.selected;
          const committed = this.commitRatio(record, pending.target, s);
          if (!committed) { this.release(record, 'shift_handover_or_readback_failed'); return; }
          record.selected = pending.target; pending.committed = true;
          // Presentation is optional and cannot interrupt a confirmed physical shift.
          if(from !== record.selected) {
            try { api.shiftFeedback?.({from,to:record.selected,atMs:now}); } catch (_) {}
          }
          record.previousRatio = null; this.publish(record);
          record.limiter = { since: null, cutting: false };
        }
        if (pending.committed && age >= c.shift.cutMs) record.pending = null;
      } else if (this.mode === 'auto' && !s.inAir) {
        const cap = record.caps[record.selected - 1];
        const speedKmh = s.speedMps * 3.6;
        const rolling = !record.wheels.available || record.wheels.slip <= c.shift.maxAutoSlip;
        // RPM alone is ambiguous during wheelspin or a stationary engine rev.
        // Estimated ceilings are active on intermediate gears, never the final.
        const rpmReady = s.speedMps >= (c.shift.minRollingMps ?? 1)
          && L.shiftRpm(s, record) >= (record.profile.upRpm ?? c.shift.upRpm)
          && L.autoRpmUpshiftReady(s, cap, c);
        const capReady = speedKmh >= cap * c.shift.capFraction;
        if (record.selected > 1 && L.autoDownshiftReady(s, record.caps[record.selected - 2], c))
          this.requestShift(-1, false, true);
        else if (record.selected < record.table.length && s.brake < 0.05 && s.throttle >= c.shift.minAutoThrottle
          && rolling && (rpmReady || capReady))
          this.requestShift(1, false, true);
      }
      // Selective overspeed braking only; no grip, drive-bias or power override.
      // No speed-derived cut in the last gear, even for a configured profile.
      this.applyLimiter(record, s, now);
      this.braking.update(record, s, now, this.mode);
        this.capRpm.update(record, s, now, this.mode);
      this.report('active', null, { family: record.profile.family, logicalGears: record.table.length, source: record.profile.source });
    }
    requestShift(direction, stationaryFirst = false, automatic = false) {
      const api = this.api, record = this.records.get(this.currentVehicle);
      const manualDown = direction === -1 && !automatic && !stationaryFirst;
      const rangesAllowed = this.mode === 'seq' && !automatic && !stationaryFirst;
      if (!record || record.phase !== 'active' || (record.directionTransition && !rangesAllowed) || (record.pending && !manualDown) || !api.isDriver(record.vehicle) || !api.controlled(record.vehicle)) return false;
      if (!stationaryFirst && direction !== 1 && direction !== -1) return false;
      if (!manualDown && api.now() - record.lastShift < this.config.shift.cooldownMs) return false;
      const s = this.capRpm.sample(record, api.read(record.vehicle));
      if (!L.validSample(s) || !s.engineRunning || s.high !== 1
        || !L.near(api.ratio(record.vehicle, 1), record.expectedRatio)) return false;
      // A manual down request can replace an upshift or extend queued downs.
      // No speed/RPM protection or cooldown discards the driver's selection.
      const position = rangesAllowed ? this.manualRange.position(record, s) : record.selected;
      const base = manualDown && record.pending && !record.pending.committed
        ? Math.min(position, this.manualRange.pendingPosition(record)) : position;
      const target = base + direction;
      if (!Number.isInteger(target) || target < (rangesAllowed ? -1 : 1) || target > record.table.length) return false;
      if (rangesAllowed && (target <= 0 || record.manualRange)) {
        if (![0, 1].includes(s.current) || ![0, 1].includes(s.next)) return false;
        return this.manualRange.queue(record, target);
      }
      if (s.current !== 1 || s.next !== 1) return false;
      const stationaryReset = stationaryFirst && s.speedMps <= this.config.stationaryMps && Math.abs(s.forwardMps) <= this.config.stationaryMps;
      if (automatic && target < record.selected && !stationaryReset && !L.autoDownshiftReady(s, record.caps[target - 1], this.config)) {
        this.report('active', 'auto_downshift_speed_rejected'); return false;
      }
      record.pending = { target, at: api.now(), committed: false, frames: 0, stationaryFirst: stationaryReset, automatic };
      record.lastShift = api.now(); api.cutThrottle(); return true;
    }
    setMode(mode) {
      const vehicle=this.api.driverVehicle();
      if (!['auto', 'seq', 'native'].includes(mode)||!vehicle||!this.api.exists(vehicle)||!this.api.isDriver(vehicle)||!this.api.controlled(vehicle)) return false;
      this.vehicleModes.set(vehicle,{model:this.api.model(vehicle),mode});this.mode=mode;
      this.manualRange.modeChanged(this.records.get(vehicle), mode);
      if (mode === 'native') {const record=this.records.get(vehicle);if(record)this.release(record,'mode_native');}
      return true;
    }
    suspend(key) {
      if (typeof key !== 'string' || !key.trim() || key.length > 100) return false;
      this.suspensions.add(key);
      let complete = true;
      for (const record of [...this.records.values()]) if (!this.release(record, 'integration_suspend')) complete = false;
      return complete;
    }
    resume(key) { return this.suspensions.delete(key); }
    rearm() {
      if (!this.currentVehicle || this.records.has(this.currentVehicle)) return false;
      this.blocked.delete(this.currentVehicle); return true;
    }
    stop() {
      this.stopping = true;
      for (const record of [...this.records.values()]) this.release(record, 'resource_stop');
      return this.records.size === 0;
    }
    telemetry() {
      const record = this.records.get(this.currentVehicle);
      let actualNative = null;
      if (record && this.api.exists(record.vehicle)) {
        const actual = this.api.read(record.vehicle);
        const ratio = actual.current >= 0 ? this.api.ratio(record.vehicle, actual.current) : null;
        actualNative = { current: actual.current, next: actual.next, high: actual.high,
          engagedRatio: L.finite(ratio) && ratio !== 0 ? ratio : null, rpm: actual.rpm,
          clutch: L.finite(actual.clutch) ? actual.clutch : null,
          throttleOffset: L.finite(actual.throttleOffset) ? actual.throttleOffset : null };
      }
      const limited = record?.phase === 'active' && !record?.directionTransition && !record?.manualRange && this.config.limiter.enabled && record.backend === 'ratio' && record.selected < record.table.length;
      return clone({ version: '0.3.1-seq-nr-dev', mode: this.mode, ...this.status, backend: record?.backend ?? null,
        transmissionStrategy: record?.profile?.strategy ?? null, finalNativeDomain: false, finalLogicalRatio: !record?.manualRange && record?.selected === record?.table?.length && !!record?.table,
        heldNativeGear: record?.manualRange === 'N' ? null : record?.manualRange === 'R' ? 0 : record?.backend === 'ratio' ? 1 : null,
        manualRange: record?.manualRange ?? null,
        actualNative, directionTransition: record?.directionTransition ?? null, effectiveCapKmh: limited ? record.caps[record.selected - 1] : null,
        observedMotion: record?.motion ?? null,
        lastFinalTransition: record?.lastFinalTransition ?? null,
        intermediateRpmFactor: record?.rpmRangeFactors?.[record.selected - 1] ?? 1,
        baseRatio: record?.baseTable?.[record.selected - 1] ?? null,
        shiftDecisionRpm: record?.observed ? L.shiftRpm(record.observed, record) : null,
        physicalRatio: record?.observed ? this.physicalRatio(record, record.observed) : null,
        pendingRestores: [...this.records.values()].filter(r => r.phase !== 'active').length,
        selected: record?.manualRange || record?.selected || null, logicalGears: record?.table?.length ?? null,
        nativeGear: record?.observed?.current ?? null, nativeRpm: record?.observed?.rpm ?? null,
        referenceKmh: record?.referenceKmh ?? null, capKmh: record?.manualRange ? null : record?.caps?.[record.selected - 1] ?? null,
        capsAreEstimates: !record?.profile?.capsKmh, pendingShift: !!record?.pending,
        speedLimiterEnabled: !!limited,
        engineBrake: this.braking.telemetry(record), capRpm: this.capRpm.telemetry(record),
        limiterCutting: !!record?.limiter?.cutting, drivenWheels: record?.wheels ?? null,
        calibrated: false, physicsValidatedInFiveM: false });
    }
  }
  root.StandaloneGearboxController = Controller;
  if (typeof module !== 'undefined' && module.exports) module.exports = Controller;
})(globalThis);
