# Client HUD API — version 1

The stable display API works with `hud: false`, independently of NUI and any RP framework. All exports described here are **client-side**.

Use the logical `gear` / `displayGear` from this API. GTA's native current gear is the physical carrier used by the controller and does not represent the displayed logical gear.

## Read the current state

```js
const state = exports['standalone_gearbox'].getHudState();
console.log(state.gear, state.mode, state.speedKmh);

on('standalone_gearbox:state', state => {
  // Replace this with your own HUD update.
  // gear !== null includes forward gears, explicit Neutral ('N') and reverse ('R').
  SendNuiMessage(JSON.stringify({
    action: 'gearbox',
    visible: state.gear !== null,
    gear: state.displayGear,
    mode: state.mode,
    speedKmh: state.speedKmh
  }));
});
```

```lua
local state = exports['standalone_gearbox']:getHudState()

AddEventHandler('standalone_gearbox:state', function(state)
    -- Local event: do not use RegisterNetEvent for this display feed.
    SendNUIMessage({
        action = 'gearbox',
        visible = state.gear ~= nil,
        gear = state.displayGear,
        mode = state.mode,
        speedKmh = state.speedKmh
    })
end)
```

Your own NUI must handle the example message. Start your HUD after `standalone_gearbox`; when the dependency is mandatory, add `dependency 'standalone_gearbox'` to your HUD manifest.

`getHudState()` returns a fresh snapshot. Mutating it does not change the gearbox. The local event emits changed snapshots at up to 10 Hz. An inactive snapshot clears the display on exit/stop; also hide your HUD if this resource stops. Polling at a modest interval is an alternative.

## Field contract

| Field | Value |
|---|---|
| `apiVersion` | `1` |
| `vehicle` | Local client vehicle handle; `0` without a target |
| `model` | Unsigned 32-bit model hash, or `null` |
| `active` | Custom forward transmission is currently owned and valid |
| `gear` | Logical gear integer, `'N'` for explicit sequential Neutral, `'R'` for owned reverse, or `null` |
| `displayGear` | Logical gear, `'D'` for automatic CVT, `'N'`, `'R'`, or `null` |
| `gearCount` | Number of logical positions; `0` outside ownership |
| `mode` | `'auto'`, `'seq'`, or `null` outside ownership |
| `speedKmh` | Native speed converted to km/h; `0` if unavailable |
| `shifting` | Whether a gear change is pending |
| `targetGear` | Pending logical gear, or `null` |
| `strategy` | Profile strategy, or `null` |
| `effectiveCapKmh` | Active intermediate speed cap; `null` in final gear, outside control or with limiter disabled |
| `phase` | Technical controller phase; use `gear` / `active` for ordinary display logic |
| `controlled` | Whether this client currently has network control |
| `canChangeMode` | Recent server permission hint for a button, never authority to make a change |

JavaScript `null` values are absent/nil when read through Lua. Explicit sequential Neutral and reverse both use `active: false` while retaining their owned `gear: 'N'` or `gear: 'R'` and mode. An excluded, unsupported or uncontrolled vehicle must not be presented as an active custom gearbox.

`canChangeMode` is refreshed by server synchronization, normally every two seconds, and expires after five seconds without a fresh valid reply. The server still rechecks every mode request.

`getState()` is the separate detailed diagnostic export. Its internal fields are not the stable HUD contract. Recovery state bags are internal journals, not a public telemetry API.

## Request an action

```js
const queued = exports['standalone_gearbox'].requestMode('toggle');
// Also accepts 'auto' or 'seq'.
// true means queued, not granted: observe the next state.
const accepted = exports['standalone_gearbox'].shift(1); // -1 to shift down
```

```lua
local queued = exports['standalone_gearbox']:requestMode('seq')
local accepted = exports['standalone_gearbox']:shift(-1)
```

The key bindings and `/sgbox auto|seq|toggle` commands use the same permission route. Requests require the current driver, a networked vehicle and server approval. Stale responses and responses for previous vehicles are ignored. A response received during a mechanical shift is applied after that shift.

Only one mode request can be pending; it expires after two seconds. Client requests are separated by at least 150 ms. An accepted manual shift is a request, not proof of a completed physical change.

Maintenance exports are covered in [INTEGRATION.md](INTEGRATION.md).
