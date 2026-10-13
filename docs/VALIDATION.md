# Validation and acceptance

Version 0.3.0 prepares the resource for distribution: readable configuration, EN/FR player text, automatic coverage, server permissions, a documented HUD API and a verified installation archive.

## Automated checks

Release checks completed on 13 October 2026:

- 286 automated tests passed with simulated FiveM natives.
- 23 JavaScript files parsed successfully; manifest paths, load order, private server files and release version checked.
- HUD browser checks passed at 1920×1080, 1366×768 and 960×540, including English/French labels, transparency, gear hints and stale-display cleanup.
- Optional audio produced no file request or browser error while disabled. No optional sound recording is included in this archive.
- Independent source review found no remaining blocking issue in the configuration, permissions and public HUD API.

These checks cover this packaged revision. No fresh in-game driving or live ESX/QBCore integration test was performed for 0.3.0.

The development workspace was checked with the commands below. The test suite and build tools are not included in this installable resource repository:

```sh
npm test
npm run check
python tools/package_share.py
```

The tests run the controller and runtime adapters with simulated FiveM natives. Coverage includes ratio transactions and restoration, automatic/manual selection, reverse, model fallback, permissions, stale responses, HUD state, and maintenance integrations. The syntax checker parses the JavaScript files.

The package builder verifies the resource version against its manifest, manifest file references, public documentation links, archive inventory and every file's SHA-256. Only one installable `standalone_gearbox/` directory is included. Developer tools, test server state, old archives and private host overlays are excluded.

A successful automated run is not an in-game physics result. The ZIP's adjacent JSON report describes exact packaged bytes; it does not certify an untested server deployment.

## In-game acceptance checklist

1. Start on an up-to-date OneSync server and check client/server consoles for errors.
2. Enter an ordinary car at low speed. Check Auto, Sequential, reverse, all three key bindings and rebinding through FiveM settings.
3. Confirm the vehicle retains its mode when a second driver takes over. A different vehicle should receive its own default.
4. Test an unlisted add-on, a model override, an excluded model and selected-only mode if used.
5. Disable the included HUD and confirm your custom HUD still receives forward gear, R, mode and the inactive state on exit.
6. Test authorized and unauthorized drivers for your chosen permission strategy. For jobs, test grade, duty, role changes and framework restart on your actual ESX/QBCore version.
7. Verify intermediate caps, automatic downshift, the uncapped final gear, throttle cut and any approved optional audio.
8. Check vehicle handover, resource stop/start and garage suspension/recovery before combining gearbox or handling resources.
9. For unusual drivetrains, compare acceleration, top speed, braking, wheel targeting and restoration to a native baseline on the same vehicle/setup.

## Known boundaries

There is no claim of universal physical validation across every GTA build and add-on. Framework adapters are covered by simulated tests; your installed framework version still needs an integration check.

Vehicle modes exist for the life of the entity/resource and are not persistent by plate. Permission checks protect the normal mode-change requests, not all client-side physics from modified clients. Wheel-braking readbacks do not certify tire forces.

Historical deployment reports retained in the development workspace describe older local test builds. They are not evidence that 0.3.0 has been installed or driven on a server.
