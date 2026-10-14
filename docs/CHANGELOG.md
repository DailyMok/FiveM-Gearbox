# Release notes

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
