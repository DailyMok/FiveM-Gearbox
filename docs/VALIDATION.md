# Validation and acceptance

## Published 0.3.2 validation

Version 0.3.2 adds manual Neutral and Reverse selection in Sequential mode (`1 → N → R` and `R → N → 1`, with sticky explicit `N` and explicit `R` pinning gear `0` without native automatic `R → 1` flip) alongside three independent wheel/controller button mappings (`+sgbox_dev_up`, `+sgbox_dev_down`, `+sgbox_dev_toggle`). See the [manual Neutral/Reverse guide](MANUAL-NEUTRAL-REVERSE.md) and the [input device guide](INPUT-DEVICES.md).

Release checks completed on 15 October 2026:

- 342 automated tests passed with simulated FiveM natives, including 34 sequential Neutral/Reverse tests and 21 input-device tests.
- Coverage includes sequential `1 → N → R` and `R → N → 1` transitions across speed ranges, sticky explicit Neutral while coasting or pressing throttle/brake, explicit Reverse pinning gear `0` and restoring clean forward ratios, joystick/gamepad defaults, invalid and conflicting defaults, English/French labels, server authorization, local vehicles, preserved keyboard mappings and absence of profile writes.
- A duplicated shift or mode request through the keyboard and device mappings in the same frame produces one action. Repeated presses through one mapping and presses on subsequent frames remain accepted.
- 25 JavaScript files parsed successfully; manifest paths, load order, private server files and version 0.3.2 checked.

## Previous 0.3.1 validation

Version 0.3.1 prevented repeated missing-network-object warnings when an integration creates a local vehicle. Normal mode changes still require a valid network ID and server authorization.

## Automated checks

HUD browser checks at 1920×1080, 1366×768 and 960×540 were completed for version 0.3.0 on 13 October 2026, including English/French labels, transparency, gear hints and stale-display cleanup. Those historical checks also confirmed that disabled optional audio produced no file request or browser error. No optional sound recording is included in the archive.

The source repository provides:

```sh
npm test
npm run check
python tools/package_share.py
```

The tests run the controller and runtime adapters with simulated FiveM natives. Coverage includes ratio transactions and restoration, automatic/manual selection, sequential Neutral/Reverse, model fallback, permissions, stale responses, HUD state, and maintenance integrations. The syntax checker parses the JavaScript files.

The package builder verifies the resource version against its manifest, manifest file references, public documentation links, archive inventory and every file's SHA-256. Only one installable `standalone_gearbox/` directory is included. Developer tools, test server state, old archives and private host overlays are excluded.

A successful automated run is not an in-game physics result. Build verification reports retained in the development workspace describe exact packaged bytes; they do not certify an untested server deployment.

## In-game acceptance checklist

1. Start on an up-to-date OneSync server and check client/server consoles for errors.
2. Enter an ordinary networked car at low speed. Check Auto, Sequential, `1 → N → R` and `R → N → 1` in Sequential, keyboard and wheel/controller bindings, and rebinding through FiveM settings. Confirm that an authorized driver can switch with M after reconnecting.
3. Confirm the vehicle retains its mode when a second driver takes over. A different vehicle should receive its own default.
4. Test an unlisted add-on, a model override, an excluded model and selected-only mode if used.
5. Disable the included HUD and confirm your custom HUD still receives forward gear, N, R, mode and the inactive state on exit.
6. Test authorized and unauthorized drivers for your chosen permission strategy. For jobs, test grade, duty, role changes and framework restart on your actual ESX/QBCore version.
7. Verify intermediate caps, automatic downshift, the uncapped final gear, throttle cut and any approved optional audio.
8. Check vehicle handover, resource stop/start and garage suspension/recovery before combining gearbox or handling resources.
9. For unusual drivetrains, compare acceleration, top speed, braking, wheel targeting and restoration to a native baseline on the same vehicle/setup.
10. If an integration creates local vehicles, confirm there are no repeated missing-network-object warnings and no mode change through normal commands/exports. Then use a networked vehicle and confirm that permissions still govern switching.

## Known boundaries

A report of the Auto/Sequential action being blocked in FiveM's native rebinding menu remains unresolved. Its cause is not established.

Local vehicles are intentionally ineligible for normal server-authorized mode switching; use a networked vehicle for that feature. See [the integration guide](INTEGRATION.md).

There is no claim of universal physical validation across every GTA build and add-on. Framework adapters are covered by simulated tests; your installed framework version still needs an integration check.

Vehicle modes exist for the life of the entity/resource and are not persistent by plate. Permission checks protect the normal mode-change requests, not all client-side physics from modified clients. Wheel-braking readbacks do not certify tire forces.
