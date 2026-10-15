# Third-party provenance

## Vehicle facts

The internal model catalogue was derived from selected technical facts in [DurtyFree/gta-v-data-dumps](https://github.com/DurtyFree/gta-v-data-dumps), snapshot `b65684e00f689fdec405c5f1055322c802d3c895`. The source repository retains the input catalogue, exact references and source hashes under `research/`.

The recorded source audit found no declared license for that snapshot. Public availability must not be described as an open-source license for Rockstar assets or the full data dumps. The resource contains selected factual model/type/transmission information and project-specific gameplay classifications; it does not package the source dumps, GTA models, textures or marketing material.

## Technical references

The project uses Cfx/FiveM APIs. Manifest, key mapping, exports, state bag and native references are linked from the relevant guides.

Wheel handbrake eligibility was researched using [ikt32/GTAVManualTransmission](https://github.com/ikt32/GTAVManualTransmission/blob/master/Gears/Memory/VehicleFlags.h). This is a reference for interpreting flags; the resource does not bundle that mod or its plugin binary.

## Audio

The earlier development files `GearUp.wav` and `GearDown.wav` were copied from a local Race Island project. The owner confirmed that redistribution rights for those recordings are unavailable. Those original recordings are excluded from this release. The package builder rejects their known SHA-256 fingerprints even if renamed.

No permission to reuse third-party recordings is created by this documentation. Any replacement must have its own established provenance.

## Project license

The original code and documentation owned by DailyMok are licensed under the [DailyMok Free Use and No Resale License 1.0](../LICENSE), including version 0.3.0. Use, modification and free redistribution are permitted, including operation on monetized FiveM servers. Selling the mod, modified versions, substantial portions or paid packs containing them is prohibited. Copyright and license notices must be retained.

This is a custom source-available license, not MIT or an OSI-approved open-source license. It grants no additional rights over third-party code, datasets, Rockstar/FiveM assets, trademarks or the excluded audio recordings. The provenance notices above remain applicable. The English LICENSE file contains the governing terms; README summaries do not replace it.
