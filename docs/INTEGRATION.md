# Resource integrations

All gearbox exports run on the client. Keep the resource name `standalone_gearbox`. Use [HUD-API.md](HUD-API.md) for ordinary HUDs and public mode requests.

## Networked vehicles and mode authorization

Normal player mode requests, including commands and the public `requestMode` export, require a networked vehicle with a valid network ID. The server uses that ID to verify the vehicle and driver before authorizing a change. A purely local vehicle cannot be switched through this permission flow.

Version 0.3.1 checks `NetworkGetEntityIsNetworked` before reading a network ID. For a local vehicle it returns zero and does not call `NetworkGetNetworkIdFromEntity` or send a mode-authorization request, preventing repeated missing-network-object warnings. When a vehicle becomes networked, normal switching still requires a server response. This guard does not bypass permissions or turn local vehicles into networked entities.

If your spawner should create vehicles whose mode players can change, create them as networked entities and ensure they have a valid network ID before requesting a mode change. In a client-side `CreateVehicle` call, set the `isNetwork` argument to `true`; choose the remaining arguments for your spawner's ownership and lifecycle needs. Do not silently register another resource's local vehicles as networked from the gearbox.

## Coordinate a garage or another gearbox

Add only your approved integration's exact resource name to `config.js`:

```js
trustedResources: ['my_garage'],
```

Then suspend control before writing transmission/handling values:

```js
const released = exports['standalone_gearbox'].suspend('my_garage');
// Proceed only if released === true, or wait until isReleased() === true.
// Apply the garage's changes after release.
exports['standalone_gearbox'].resume('my_garage');
```

Use a separate stable key for each integration. Resuming one key does not remove other suspension keys. Release can remain pending while network control is absent or a driver's brake input takes priority; do not modify the transmission until it completes.

| Export | Result |
|---|---|
| `requestMode('auto'|'seq'|'toggle')` | Queue a normal server-checked request |
| `shift(1|-1)` | Request a manual shift |
| `getHudState()` | Stable display snapshot |
| `getState()` | Detailed technical diagnostics |
| `isReleased()` | No tracked transmission/recovery is pending on this client |
| `suspend(key)` | Trusted only; suspend and return whether local release is complete |
| `resume(key)` | Trusted only; remove that suspension key |
| `setMode('auto'|'seq'|'native')` | Trusted: temporary local override; untrusted: only normal server mode requests |
| `bindRemoteVehicle(vehicle)` | Trusted only; bind an explicitly controlled empty RC vehicle; `0` clears it |

A trusted `setMode('native') === true` confirms the requested mode, not completed release. Check `isReleased()`. A trusted override is local to the current vehicle and ends when leaving it or moving to another network entity; it is not persisted as the next driver's server mode.

`isReleased()` covers this client, not all clients on the server. No public player command grants maintenance access. Trusted resources are privileged code; these checks are not an anti-cheat boundary against a modified client.

## Detect known conflicts

List incompatible gearbox resources in `conflictingResources`. While one is started, Standalone Gearbox releases its vehicle and stays suspended.

For a resource that handles only certain models, prefer `enabled: false` for those models in `vehicle-profiles.js`. For a garage that writes only temporarily, use suspend/resume.

The controller detects some unexpected ratio/gear-limit changes and releases ownership. It cannot recognize every external script acting on input, torque, clutch or wheel state. Explicit coordination is more reliable.

## Remote-controlled vehicles

The resource that actually controls an empty RC vehicle can call:

```js
exports['standalone_gearbox'].bindRemoteVehicle(vehicle);
// At the end, from the same resource:
exports['standalone_gearbox'].bindRemoteVehicle(0);
```

The caller must be trusted, hold network control and provide a supported empty vehicle. Another resource cannot take over an existing binding. The gearbox reads local driving inputs; an RC controller with private input values needs its own integration. Ordinary server mode requests require a seated driver; an RC integration can use its trusted temporary override.

Loss of control, entity deletion or the controlling resource stopping ends the binding and triggers recovery.

## Recovery and upgrades

The `standalone_gearbox:v1` entity state bag records owned transmission changes and their original values for recovery. It is an internal journal. Do not edit it, delete it while a vehicle is modified, or use it as a HUD API.

Before replacing runtime files on a running server, stop driving and complete release through trusted maintenance integrations where applicable. Back up your administrator files and merge them into the new version. For old local `host-config.js` overlays, migrate model exceptions to `vehicle-profiles.js`; if preserving an overlay, load it after `shared/bootstrap.js`, where `StandaloneGearboxConfig` is now created.

Recovery depends on retained entity state and a client regaining control. A crash or deletion is not durable vehicle persistence. Verify driver handover and stop/start behavior in FiveM after changing integrations.

## Native references

The physical controller uses Cfx [gear-ratio getters](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/GetVehicleGearRatio.md) and [setters](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/SetVehicleGearRatio.md). Ownership recovery uses [state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/). These APIs do not by themselves prove a particular acceleration, braking force or top speed.
