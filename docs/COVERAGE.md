# Vehicle coverage

## No model allowlist by default

With `vehicles: 'all'`, the gearbox classifies vehicles from native type/class and transmission data. New add-ons do not need to appear in a config file or in the built-in catalogue. `vehicle-profiles.js` is an optional set of exceptions.

The built-in `internal/model-profiles.js` contains family hints and special cases. The underlying research snapshot contains 806 entries: 768 motorized models, nine pedal bicycles and 29 trailers. Those counts describe input data, not 768 successful in-game driving tests or every future GTA update.

## Default behavior

| Family | Gameplay behavior |
|---|---|
| Ordinary car | Usually 5 or 6 logical gears from estimated reference speed |
| Sports / super car | At least 6 by default |
| Motorcycle | 6 by default, with optional model exceptions |
| Electric / single-ratio native transmission | Virtual physical ratio steps |
| Scooter | CVT in Auto, virtual steps in Sequential; Auto displays D |
| Quad / kart | 5 logical positions by default |
| Heavy vehicle / industrial vehicle | 6 by default; explicitly classified heavy trucks use 12 |
| Amphibious / transforming vehicle | Road control; release in water or detected non-road mode |
| Remote-controlled vehicle | Supported through an explicit trusted RC integration |

These counts are gameplay settings, not claims about manufacturer transmissions.

Pedal bicycles, trailers, trains, boats and aircraft are outside this road gearbox's scope. An override cannot turn missing native transmission functionality into a supported mechanism.

## Activation requirements

The local player must drive the vehicle (or a trusted RC integration must bind it), have network control, and provide valid native transmission data. Initial capture waits for a natural first gear at low speed with the engine running. If it does not engage after entering a moving vehicle, slow down and retry.

A broken add-on ratio table, missing native or external gearbox conflict is reported instead of being treated as successful control. The absence of wheel-routing data disables the extra wheel-braking aid rather than automatically excluding the whole gearbox.

## Physical versus logical gears

The logical gear is separate from GTA's current native gear. The controller uses native slot 1 as a physical carrier and changes its ratio. Twelve logical gears do not require twelve native slots. Display the [public HUD API](HUD-API.md).

Intermediate gears have speed caps; the final gear keeps the original long ratio without an added speed cap. The reference speed and generated caps are estimates unless deliberately calibrated. No added cap does not prove unchanged measured top speed.

Automatic mode selects upward by RPM/cap and downward from the lower gear's cap minus 10 km/h. Sequential mode leaves selection to the driver. Manual downshifts are not rejected solely for high speed or RPM, but valid entity, ownership, data and transaction readback remain required.

Native tables are restored from the original snapshot, preserving their order and values. Add-on handling, native builds and preparation can still affect the physical result. Test representative vehicles and your own add-ons before using the resource on a public server.
