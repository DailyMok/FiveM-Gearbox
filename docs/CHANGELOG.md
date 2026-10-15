# Release notes

## 0.3.2 — 2026-10-15

- **Sequential manual Neutral and Reverse (`1 -> N -> R` and `R -> N -> 1`):** downshift past first gear selects `N` and then `R` with the existing keyboard, wheel/controller, command and `shift` export inputs; upshift from `R` steps through `N` back to `1`. Manual `N`/`R` selection has no vehicle-speed threshold; native brake/reverse input (`S` / control 72) remains the reverse driving input.
- **Explicit `N` / `R` state handling:** an explicitly selected `N` stays engaged (applying zero native engine torque each frame while preserving brake input) until another manual shift or switching to `Auto`. An explicitly selected `R` pins native current/next gear `0` while keeping the native reverse ratio, and returns to `1` either manually (`R -> N -> 1`), via `Auto`, or at standstill when the accelerator is pressed. Without a manual `N`/`R` selection, the existing automatic reverse-at-standstill behavior remains. See [MANUAL-NEUTRAL-REVERSE.md](MANUAL-NEUTRAL-REVERSE.md).
- **HUD and public API (`apiVersion: 1`):** `gear`, `displayGear` and `targetGear` now expose `'N'` as well as `'R'`, with `active: false` in both ranges. Custom HUDs should use `gear !== null` for visibility.
- **Independent wheel/controller bindings:** added three separate native FiveM mappings (`+sgbox_device_up`, `+sgbox_device_down`, `+sgbox_device_toggle`) that start unassigned and preserve the existing keyboard bindings (`M`, `Page Up`, `Page Down`) and server mode permissions.
- **Cross-source duplicate suppression and optional `deviceKeys`:** suppresses duplicate same-frame requests arriving through both keyboard and device mappings while preserving rapid repeated presses on the same mapping. Added optional `deviceKeys` server defaults for joystick buttons `1–32` and digital gamepad buttons, with EN/FR setup instructions in [INPUT-DEVICES.md](INPUT-DEVICES.md).
- Passed **342 automated tests** and **25 JavaScript file checks**. See [VALIDATION.md](VALIDATION.md).

## 0.3.1 — 2026-10-14

- Guard network-ID lookup with `NetworkGetEntityIsNetworked` so vehicles created locally by an integrating resource do not flood the client log with missing-network-object warnings. Local vehicles still cannot use the server-authorized mode-change protocol. A regression test covers repeated ticks and mode commands on a local vehicle, then its transition to a networked entity requiring a server reply. Post-fix in-game mode switching has not yet been confirmed.
- No configuration migration is required from 0.3.0. Networked vehicles keep the existing server permission checks.
- The separately reported issue with FiveM's native key-binding menu remains unresolved; this patch does not change input mappings or device settings.

## 0.3.0

License/documentation update: the original DailyMok code and documentation are now covered by the [Free Use and No Resale License](../LICENSE). Monetized servers are permitted; resale and paid redistribution of the mod are prohibited. The installable ZIP has been refreshed to include the license and updated documentation. The game scripts and original `v0.3.0` source tag are unchanged; the refreshed ZIP has a new SHA-256 checksum.

- Simplified administrator entry points: general settings, optional model exceptions, and private server permissions.
- English configuration comments and documentation, plus a French README.
- EN/FR player-facing labels selected with `locale`; English by default.
- Three standard FiveM rebindable controls for mode, shift up and shift down.
- Automatic coverage remains the default, including unlisted eligible add-ons. The built-in catalogue is internal.
- Public HUD API remains available independently of the included HUD, with explicit logical gear/mode fields.
- Reviewed mode authorization, response lifetime and vehicle identity handling.
- Declared conflict detection and trusted integration settings.
- Installable archive with all public guides, file inventory and SHA-256 verification.
- Removed development sound recordings from distribution because redistribution rights were unavailable.

Existing administrator option names and the version 1 HUD API are retained. Internal load paths changed; use the new manifest and merge your settings. Legacy host overlays that access `StandaloneGearboxConfig` must load after `shared/bootstrap.js`.

The established driving model is retained. Automated checks do not replace a FiveM drive test.
