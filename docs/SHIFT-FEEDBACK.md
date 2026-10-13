# Shift feedback and optional sound

The installable release contains **no audio recordings**. Shift sounds are disabled by default; the gearbox works fully without them.

A normal gear change retains its brief throttle cut. The default cut window is 200 ms from the accepted request, with engagement after at least 40 ms and two observations. Actual timing depends on client frame rate. Brake input remains available.

## Add your own licensed sounds

1. Use recordings you are permitted to redistribute to your players.
2. Create `web/audio/` inside the resource and add `GearUp.wav` and `GearDown.wav` with exactly those names.
3. Add both paths to the existing `files` block in `fxmanifest.lua`, keeping the existing entries:

```lua
files {
    'web/index.html', 'web/style.css', 'web/app.js', 'web/gear-sound.js',
    'web/audio/GearUp.wav', 'web/audio/GearDown.wav'
}
```

4. Enable audio in `config.js`:

```js
shiftSounds: { enabled: true, volume: 100 },
```

5. Restart the resource and check a confirmed upshift and downshift.

Playback starts at the beginning of each file and lasts at most 0.6 seconds. Keep the desired sound at the start. Files are loaded only when a sound is requested, so leaving audio disabled does not request missing files.

The volume range is 0–100. Maximum digital gain is 0.30; 50 gives 0.15 and 0 is silent. Invalid values are silent. This scale is not a measurement of perceived loudness.

One sound accompanies a confirmed gear change. Refused requests, an unconfirmed native write, initial capture and the reverse/first transition do not play a shift sound. An audio failure does not stop the mechanical controller. The throttle cut is independent of audio.

## Provenance

The previous development WAV recordings were excluded from distribution because their public redistribution rights were not established. They are not licensed by this project and must not be copied from old development archives into a public package.

The archive inventory identifies every distributed file. The source package builder rejects the known original recordings even if renamed. Including an approved replacement through that builder additionally requires `--include-approved-audio`.

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
