(function (root) {
  'use strict';
  const index = value => value === 'N' ? 0 : value === 'R' ? -1 : value;
  const label = value => value === 0 ? 'N' : value === -1 ? 'R' : value;

  class ManualRange {
    constructor(controller) { this.controller = controller; this.api = controller.api; }
    position(record, sample) {
      if (record.manualRange) return index(record.manualRange);
      if (sample.current === 0 || sample.next === 0) return -1;
      if (record.directionTransition?.resetFirst) return 1;
      return record.selected;
    }
    pendingPosition(record) { return index(record.pending?.target); }
    queue(record, target) {
      if (![-1, 0, 1].includes(target)) return false;
      if ((target <= 0 || record.manualRange) && !this.api.neutralCapabilities()) return false;
      record.pending = { target: label(target), at: this.api.now(), frames: 0, committed: false, range: true };
      record.lastShift = this.api.now(); this.api.cutThrottle();
      return true;
    }
    hold(record) {
      if (record.manualRange === 'N') {
        // GTA gear 0 is reverse, not neutral. Suppress engine drive for this
        // frame only; leave the player's brake input available. No reset-to-1
        // torque write on exit: another resource may own its own multiplier.
        if (!this.api.neutralCapabilities()) return false;
        this.api.neutralDrive(record.vehicle);
      } else if (record.manualRange === 'R') {
        // Keep GTA's original reverse ratio and normal brake/reverse input.
        // Readback verifies selection, not rearward tire force while sliding.
        this.api.setNext(record.vehicle, 0); this.api.setCurrent(record.vehicle, 0);
        const sample = this.api.read(record.vehicle);
        if (sample.current !== 0 || sample.next !== 0) return false;
      }
      return true;
    }
    modeChanged(record, mode) {
      if (!record || mode !== 'auto') return;
      // A trusted integration may change mode without waiting for a pending
      // shift, unlike the normal server permission route.
      if (record.pending?.range) record.pending = null;
      if (record.manualRange === 'N') this.queue(record, 1);
      else if (record.manualRange === 'R') {
        record.manualRange = null;
        record.directionTransition = { since: this.api.now(), resetFirst: true };
      }
    }
    update(record, sample, now) {
      if (!record.manualRange && !record.pending?.range) return false;
      const controller = this.controller, api = this.api, config = controller.config;
      controller.capRpm.stop(record, 'manual_range');
      record.limiter = { since: null, cutting: false };
      // A previously owned overspeed brake/lock must be restored before any
      // range change. The existing recovery journal continues to own it.
      if (!controller.braking.release(record, 'manual_range')) {
        if (record.manualRange === 'N' && !this.hold(record)) {
          controller.release(record, 'manual_range_write_failed'); return true;
        }
        if (record.pending?.range) { record.pending.at = now; record.pending.frames = 0; }
        api.cutThrottle(); controller.report('active', 'manual_range_brake_restore_pending'); return true;
      }
      if (!record.pending && record.manualRange === 'R' && sample.speedMps <= config.stationaryMps
        && sample.throttle > 0.1 && sample.brake <= 0.05) this.queue(record, 1);
      const pending = record.pending;
      let held = false;
      if (pending?.range) {
        const age = now - pending.at;
        if (age < 0 || age > config.shift.maxGapMs) { controller.release(record, 'range_shift_clock_gap'); return true; }
        if (age < config.shift.cutMs || !pending.committed) api.cutThrottle();
        pending.frames++;
        if (!pending.committed && age >= config.shift.commitMs && pending.frames >= 2) {
          if (pending.target === 'N' || pending.target === 'R') {
            record.manualRange = pending.target;
            if (!this.hold(record)) { controller.release(record, 'manual_range_readback_failed'); return true; }
            held = true;
          } else {
            // A rolling return to first is a deliberate driver selection.
            // Journal the first-ratio transaction before engaging native 1.
            if (!controller.commitRatio(record, 1, sample, true)) {
              controller.release(record, 'manual_forward_readback_failed'); return true;
            }
            record.manualRange = null;
          }
          record.directionTransition = null;
          pending.committed = true;
        }
        if (pending.committed && age >= config.shift.cutMs) record.pending = null;
      }
      if (!held && !this.hold(record)) { controller.release(record, 'manual_range_readback_failed'); return true; }
      if (record.manualRange || record.pending?.range) {
        controller.report('active', record.manualRange === 'N' ? 'manual_neutral' : record.manualRange === 'R' ? 'manual_reverse' : 'manual_range_shift');
        return true;
      }
      return false;
    }
  }
  root.StandaloneGearboxManualRange = ManualRange;
})(globalThis);
