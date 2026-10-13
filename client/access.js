(function (root) {
  'use strict';
  const RESPONSE_TIMEOUT_MS = 2000;
  const PERMISSION_TTL_MS = 5000;
  const validAction = action => ['sync', 'toggle', 'auto', 'seq'].includes(action);

  function create(api, controller, config) {
    let serial = 0, pending = null, current = null, deferred = null, forced = null;
    let lastSync = -Infinity, lastRequest = -Infinity, permissionAt = -Infinity, canSwitch = false;
    const session = api.instanceId();

    function identity(vehicle = api.driverVehicle()) {
      if (!vehicle || !api.exists(vehicle)) return null;
      return { vehicle, model: root.StandaloneGearboxSettings.hash(api.model(vehicle)), netId: api.netId(vehicle) };
    }
    const same = (a, b) => a === b || !!a && !!b
      && a.vehicle === b.vehicle && a.model === b.model && a.netId === b.netId;

    function request(action = 'toggle') {
      const target = identity(), now = api.now();
      if (!validAction(action) || !target || !api.controlled(target.vehicle)
        || !api.isDriver(target.vehicle) || !config.enabled) return false;
      if (action !== 'sync' && !config.allowModeSwitch) return false;
      if (pending && now >= pending.at && now - pending.at < RESPONSE_TIMEOUT_MS) return false;
      if (now >= lastRequest && now - lastRequest < 150) return false;
      if (controller.entryFor(api.facts(target.vehicle))?.passthrough) return false;
      if (!Number.isSafeInteger(target.netId) || target.netId <= 0) return false;
      pending = { ...target, nonce: session + '-' + (++serial), action, at: now };
      lastRequest = now;
      try { api.sendMode(pending.nonce, target.netId, action); return true; }
      catch (_) { pending = null; return false; }
    }

    function receive(nonce, netId, result) {
      const reply = pending;
      if (!reply || nonce !== reply.nonce || netId !== reply.netId) return false;
      pending = null;
      // A matching but invalid reply must never become HUD authorization.
      canSwitch = false;
      const now = api.now();
      if (now < reply.at || now - reply.at > RESPONSE_TIMEOUT_MS || !same(reply, identity())
        || !api.controlled(reply.vehicle) || !api.isDriver(reply.vehicle)) return false;
      if (result?.ok !== true) {
        if (result?.ok === false && result.canSwitch === false && reply.action !== 'sync') {
          const reason = result.reason === 'denied' ? 'denied' : 'unavailable';
          try { api.modeRejected?.(reason); } catch (_) {}
        }
        return false;
      }
      if (!['auto', 'seq'].includes(result.mode) || result.model !== reply.model
        || !Number.isSafeInteger(result.revision) || result.revision < 0) return false;
      canSwitch = result.canSwitch === true;
      permissionAt = now;
      deferred = { ...reply, mode: result.mode };
      return true;
    }

    function tick() {
      const target = identity(), vehicle = target?.vehicle || 0, now = api.now();
      if (!same(target, current)) {
        current = target; pending = null; deferred = null; forced = null;
        canSwitch = false; permissionAt = -Infinity; lastSync = -Infinity;
        // Entity handles can be reused. Neither local choices nor a trusted
        // maintenance override may carry across a different network entity.
        controller.vehicleModes.delete(vehicle);
        controller.mode = controller.vehicleMode(vehicle);
      }
      if (now < lastSync) lastSync = -Infinity; // GetGameTimer wraps on long sessions.
      if (pending && (now < pending.at || now - pending.at >= RESPONSE_TIMEOUT_MS)) {
        pending = null; canSwitch = false;
      }
      if (controller.suspensions.size || forced && same(forced, target)) return;
      if (deferred) {
        if (!same(deferred, target) || !api.controlled(vehicle) || !api.isDriver(vehicle)) deferred = null;
        else if (!controller.records.get(vehicle)?.pending && controller.setMode(deferred.mode)) deferred = null;
      }
      // A server readback is an advisory UI capability, never permission to
      // perform a later change. Every public mode request goes to the server.
      if (vehicle && now - lastSync >= RESPONSE_TIMEOUT_MS && request('sync')) lastSync = now;
    }

    return {
      request, receive, tick,
      allowed() {
        const now = api.now();
        return canSwitch && config.allowModeSwitch === true && same(current, identity())
          && !!current && api.controlled(current.vehicle) && api.isDriver(current.vehicle)
          && now >= permissionAt && now - permissionAt <= PERMISSION_TTL_MS;
      },
      override(mode) {
        if (!controller.setMode(mode)) return false;
        current = identity(); forced = current; pending = null; deferred = null;
        return true;
      }
    };
  }
  root.StandaloneGearboxAccess = { create };
})(globalThis);
