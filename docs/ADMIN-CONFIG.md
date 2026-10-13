# Administrator configuration

Use the three administrator files below. Their comments and option names are English. Only player-facing labels change with `locale`.

Restart the resource after changing these files. Back up your settings before an update and merge them into the new files; do not replace the new manifest with an old one.

## General settings — config.js

| Setting | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Enable the gearbox |
| `locale` | `'en'` | `'en'` or `'fr'` for player-facing labels |
| `hud` | `true` | Show the included HUD; the public API remains available when false |
| `vehicles` | `'all'` | Automatic coverage; `'selected'` requires an explicit enabled model profile |
| `defaultMode` | `'auto'` | Initial mode: `'auto'` or `'seq'` |
| `allowModeSwitch` | `true` | Allow requests to change mode, subject to server permissions |
| `keys.toggle` | `'M'` | Server default for Auto/Sequential |
| `keys.up` | `'PAGEUP'` | Server default for shift up |
| `keys.down` | `'PAGEDOWN'` | Server default for shift down |
| `command` | `'sgbox'` | Player command name, without a slash |
| `shiftSounds.enabled` | `false` | Optional gear-change audio |
| `shiftSounds.volume` | `100` | 0–100; 100 applies a maximum digital gain of 0.30 |
| `trustedResources` | `[]` | Exact resource names allowed to use maintenance exports |
| `conflictingResources` | `[]` | Resource names that suspend this gearbox while running |

Typical changes:

```js
locale: 'fr',
hud: false,
defaultMode: 'seq',
allowModeSwitch: true,
keys: { toggle: 'M', up: 'PAGEUP', down: 'PAGEDOWN' },
```

Edit the properties inside the existing `StandaloneGearboxAdmin` object. JavaScript booleans are `true` / `false`, not quoted strings. Keep commas between properties.

The three key mappings are registered with FiveM. Each player can change them in Settings → Key Bindings → FiveM; already-saved bindings take precedence over new defaults.

Sound volume 0 is silent, 50 gives gain 0.15 and 100 gives gain 0.30. Invalid non-numeric values produce silence. The 200 ms throttle cut remains independent of audio.

## Automatic coverage and optional model exceptions

Leave `vehicles: 'all'` to cover all eligible road vehicles. A model does not need an administrator entry or a built-in catalogue entry. Native type/class and transmission data provide the fallback.

Use `vehicle-profiles.js` only when a model should behave differently:

```js
globalThis.StandaloneGearboxVehicleProfiles = {
  adder: { defaultMode: 'seq' },
  my_dedicated_gearbox_car: { enabled: false },
  omnis: { gears: 4, reason: 'Server gameplay choice' }
};
```

A hash can replace a spawn name:

```js
globalThis.StandaloneGearboxVehicleProfiles = {
  '3078201489': { defaultMode: 'seq', gears: 6 }
};
```

That unsigned hash and `-1216765807` identify the same Adder model. Choose one representation. Conflicting duplicate profiles disable that model with a diagnostic. Spawn names are case-insensitive.

To create an allowlist, set `vehicles: 'selected'` in `config.js`, then explicitly enable each model in `vehicle-profiles.js`:

```js
globalThis.StandaloneGearboxVehicleProfiles = {
  adder: { enabled: true },
  my_addon_car: { enabled: true, defaultMode: 'seq' }
};
```

A built-in profile does not count as explicit selection. `enabled: false` or `passthrough: true` excludes a model. `hideHud: true` hides the included HUD for that model.

Advanced fields include `gears`, `capsKmh`, `ratios`, `referenceKmh`, `family`, `strategy`, and `intermediateRpmFactor`. Caps must increase, ratios must be positive and decrease, and table lengths must match the logical gear count. These are gameplay tuning options, not manufacturer specifications. The final gear never receives an added speed cap. See [coverage](COVERAGE.md).

The built-in catalogue lives in `internal/model-profiles.js`; it is not an administrator checklist. Avoid editing it. Priority is built-in profile → administrator model profile → legacy `StandaloneGearboxConfig.modelOverrides`. New installations should use the three documented files.

## Mode permissions — server/permissions.js

Permissions apply to changing Auto/Sequential. They do not restrict normal driving or shift-up/down controls. `allowModeSwitch: false` overrides every permission strategy.

| Strategy | Allowed users |
|---|---|
| `'everyone'` | All eligible drivers |
| `'identifiers'` | Drivers with an exact matching server identifier |
| `'ace'` | Drivers who pass the configured ACE permission |
| `'jobs'` | Drivers whose current server-side job matches the rules |

Identifier example:

```js
strategy: 'identifiers',
identifiers: ['license:REPLACE_WITH_REAL_IDENTIFIER'],
```

ACE example:

```js
strategy: 'ace',
ace: 'standalone_gearbox.mode',
```

Add to your server configuration, using a group you already manage:

```cfg
add_ace group.admin standalone_gearbox.mode allow
```

Job example:

```js
strategy: 'jobs',
jobs: {
  adapter: 'qbcore', // 'esx', 'qbcore', or 'custom'
  resource: '', // Default: es_extended or qb-core.
  allowed: {
    mechanic: { minGrade: 2, requireDuty: false },
    police: { minGrade: 0, requireDuty: true }
  }
},
```

ESX reads `GetPlayerFromId(source).getJob()`; QBCore reads `GetPlayer(source).PlayerData.job`. The job grade must be a non-negative integer. If the framework does not supply a duty boolean, `requireDuty: true` denies access. Start the selected framework before the gearbox.

For another framework, set `adapter: 'custom'` and implement `customJob(source)`. It must synchronously return `{ name, grade, onDuty }` from real server-side data, or `null`. Do not return a Promise or trust values sent by a client.

Unknown strategies, unavailable frameworks, missing roles, invalid data and adapter errors deny access. Permissions are checked again on every request. Losing a role blocks the next mode change; it does not reset an already-selected vehicle mode.

Keep identifiers and private job policy in `server/permissions.js`. It is a server script and must never be added to `shared_scripts`, `client_scripts`, or `files` in the manifest.

## Mode lifetime and integrations

Modes belong to live vehicle entities. A new driver receives the existing mode. Deleting the vehicle or restarting the resource clears that choice. Modes are not persisted in a database or by plate.

Requests are checked server-side for valid vehicle, driver, routing bucket and permissions, and are rate-limited. This validates the resource's normal mode-change route; it is not a general anti-cheat for client-side vehicle physics.

Leave `trustedResources` empty unless you need a garage, RC controller or testing integration. An approved resource can temporarily override modes, suspend/resume control, and bind an RC vehicle. See [integration](INTEGRATION.md).

## Official references

The package follows the Cfx [resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/) layout and [rebindable key mapping](https://docs.fivem.net/docs/cookbook/2020/01/06/using-the-new-console-key-bindings/) mechanism. Server-side checks follow [Secure Your Events](https://docs.fivem.net/docs/developers/server-security/). These references are not a Cfx certification of this resource.
