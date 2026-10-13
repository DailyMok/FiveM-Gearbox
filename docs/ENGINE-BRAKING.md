# Engine braking and wheel assistance

The gearbox retains its existing physical-ratio and intermediate-speed behavior. This release does not claim a newly calibrated handling model.

Above an intermediate gear's cap, the controller cuts throttle and may apply additional braking to confirmed driven wheels. Wheel flags are sampled repeatedly; the controller does not assume that a fixed wheel index always represents the front or rear axle.

If driven-wheel data is missing, unstable or ambiguous, the additional aid waits while the gearbox can continue. In particular, all wheels marked driven with an exclusively front/rear drive bias are ambiguous.

## Native handbrake routing

At substantial overspeed (25% by default), the aid can temporarily change only the wheel handbrake eligibility bit and request native handbrake input for the confirmed driven wheels. It journals the original flags before modification, verifies readback, and restores its owned bits when releasing.

The driver's physical brake/handbrake takes priority. This aid is not applied in final gear, during a shift, in reverse, in the air, or in automatic CVT mode. No chassis speed is directly set.

The handbrake bit interpretation comes from the [Manual Transmission source](https://github.com/ikt32/GTAVManualTransmission/blob/master/Gears/Memory/VehicleFlags.h). Cfx exposes [wheel flags](https://github.com/citizenfx/fivem/blob/master/code/components/extra-natives-five/src/VehicleExtraNatives.cpp) and the [native handbrake command](https://github.com/citizenfx/natives/blob/master/VEHICLE/SetVehicleHandbrake.md). That evidence does not establish identical physical behavior for every model/build.

## Diagnostics and limits

`/sgbox info` exposes the selected logical gear, native readback, intermediate cap and wheel observations. A successful setter/readback confirms commanded state, not tire force or a locked physical wheel.

Use [VALIDATION.md](VALIDATION.md) to check FWD, RWD, AWD and motorcycle behavior, driver brake priority, reverse, final gear, and stop/recovery. Confirm wheel targeting and deceleration in the game before relying on a particular tune.

Mechanical settings remain in `internal/physics.js` for developers. Routine server administration belongs in the three documented configuration files.
