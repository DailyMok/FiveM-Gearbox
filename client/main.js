(function (root) {
  'use strict';
  const config = root.StandaloneGearboxConfig;
  const translate = key => root.StandaloneGearboxLocale.text(config.locale, key, { command: config.command });
  const catalogue = root.StandaloneGearboxProfiles;
  const referenceCache = new Map();
  const modelNames = new Map(Object.keys({ ...catalogue, ...config.modelOverrides })
    .filter(name => !/^[-]?\d+$/.test(name)).map(name => [GetHashKey(name), name.toLowerCase()]));
  const bool = value => value === true || value === 1;
  // State bags serialize objects: map key order is not part of their value.
  // Arrays retain order; missing, additional or changed fields still reject.
  const sameState = (a,b,depth=0) => {
    if(a===b)return true;
    if(depth>16||!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sameState(a[key],b[key],depth+1));
  };

  const diagnosticNative = (name, ...args) => {
    try { const value = typeof root[name] === 'function' ? root[name](...args) : null;
      return Number.isFinite(value) ? value : null; } catch (_) { return null; }
  };
  const nativeHandbrake = vehicle => {
    try { return typeof root.GetVehicleHandbrake === 'function' && bool(root.GetVehicleHandbrake(vehicle)); }
    catch (_) { return true; } // Unknown active brake must not invite extra pressure.
  };
  const control = id => Math.max(GetControlNormal(0, id), GetDisabledControlNormal(0, id));
  const required = ['GetVehicleCurrentGear', 'GetVehicleNextGear', 'GetVehicleHighGear', 'GetVehicleCurrentRpm',
    'GetVehicleGearRatio', 'SetVehicleGearRatio', 'SetVehicleHighGear', 'SetVehicleCurrentGear', 'SetVehicleNextGear',
    'GetVehicleEstimatedMaxSpeed', 'GetVehicleType', 'GetVehicleClass', 'GetIsVehicleEngineRunning',
    'GetEntitySpeed', 'GetEntitySpeedVector', 'NetworkHasControlOfEntity', 'Entity'];
  let remoteBinding = null;
  const driverVehicle = () => {
    const ped = PlayerPedId(), vehicle = GetVehiclePedIsIn(ped, false);
    if (vehicle && GetPedInVehicleSeat(vehicle, -1) === ped) return vehicle;
    if (remoteBinding && bool(DoesEntityExist(remoteBinding.vehicle))
      && GetEntityModel(remoteBinding.vehicle) === remoteBinding.model
      && bool(NetworkHasControlOfEntity(remoteBinding.vehicle))
      && !GetPedInVehicleSeat(remoteBinding.vehicle, -1)
      && GetResourceState(remoteBinding.owner) === 'started') return remoteBinding.vehicle;
    return 0;
  };
  const state = vehicle => Entity(vehicle).state;
  const validReference = value => Number.isFinite(value) && value > 0 && value < 1500;
  const api = {
    hashModel: name => GetHashKey(name),
    netId: vehicle => NetworkGetNetworkIdFromEntity(vehicle),
    sendMode: (...args) => emitNet('standalone_gearbox:modeRequest',...args),
    modeRejected: reason => notify(translate(reason === 'denied' ? 'denied' : 'unavailable')),
    instanceId: () => 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
    now: () => GetGameTimer(), exists: vehicle => bool(DoesEntityExist(vehicle)),
    model: vehicle => GetEntityModel(vehicle), controlled: vehicle => bool(NetworkHasControlOfEntity(vehicle)),
    isDriver: vehicle => driverVehicle() === vehicle, driverVehicle,
    missingCapabilities: () => required.filter(name => typeof root[name] !== 'function'),
    ratio: (vehicle, gear) => GetVehicleGearRatio(vehicle, gear),
    setRatio: (vehicle, gear, ratio) => SetVehicleGearRatio(vehicle, gear, ratio),
    setHigh: (vehicle, gear) => SetVehicleHighGear(vehicle, gear),
    setCurrent: (vehicle, gear) => SetVehicleCurrentGear(vehicle, gear),
    setNext: (vehicle, gear) => SetVehicleNextGear(vehicle, gear),
    rpmCapabilities: () => typeof SetVehicleCurrentRpm === 'function' && typeof GetVehicleCurrentRpm === 'function',
    setRpm: (vehicle,value) => SetVehicleCurrentRpm(vehicle,value),
    rpm: vehicle => GetVehicleCurrentRpm(vehicle),
    cutThrottle: () => DisableControlAction(0, 71, true),
    stopShiftFeedback: () => SendNuiMessage(JSON.stringify({type:'gearboxShiftSoundStop'})),
    shiftFeedback: data => {
      if(!config.shiftFeedback?.enabled)return;
      const volume=Number.isFinite(config.shiftFeedback.volume)?Math.max(0,Math.min(.3,config.shiftFeedback.volume)):0;
      SendNuiMessage(JSON.stringify({type:'gearboxShiftSound',...data,direction:data.to>data.from?'up':'down',volume}));
    },
    read: vehicle => ({ current: GetVehicleCurrentGear(vehicle), next: GetVehicleNextGear(vehicle),
      high: GetVehicleHighGear(vehicle), rpm: GetVehicleCurrentRpm(vehicle), speedMps: GetEntitySpeed(vehicle),
      forwardMps: GetEntitySpeedVector(vehicle, true)[1], throttle: control(71), brake: control(72),
      engineRunning: bool(GetIsVehicleEngineRunning(vehicle)), handbrakeInput: control(76) > 0.001, nativeHandbrake: nativeHandbrake(vehicle), handbrake: control(76) > 0.001 || nativeHandbrake(vehicle), inAir: bool(IsEntityInAir(vehicle)),
      clutch: diagnosticNative('GetVehicleClutch', vehicle),
      throttleOffset: diagnosticNative('GetVehicleThrottleOffset', vehicle) }),
    facts: vehicle => {
      const model = GetEntityModel(vehicle);
      return { model, modelName: modelNames.get(model) || String(model), type: GetVehicleType(vehicle),
        rawType: typeof GetVehicleTypeRaw === 'function' ? GetVehicleTypeRaw(vehicle) : null,
        classId: GetVehicleClass(vehicle), estimatedMaxKmh: GetVehicleEstimatedMaxSpeed(vehicle) * 3.6,
        electric: false }; // Electrical/CVT model classification comes from the reviewed catalogue.
    },
    landMode: (vehicle, profile) => {
      if (typeof IsEntityInWater === 'function' && bool(IsEntityInWater(vehicle))) return false;
      // Do not control terrestrial ratios while a transformable uses its flight
      // drivetrain. Ordinary jumps do not disable ordinary road vehicles.
      if (profile.multimode && bool(IsEntityInAir(vehicle))) return false;
      return true;
    },
    reference: model => {
      if (!referenceCache.has(model)) {
        const value = Number(GetResourceKvpString('sgbox:reference:' + config.profileRevision + ':' + model));
        referenceCache.set(model, validReference(value) ? value : null);
      }
      return referenceCache.get(model);
    },
    saveReference: (model, value) => {
      if (!validReference(value)) return;
      referenceCache.set(model, value);
      SetResourceKvp('sgbox:reference:' + config.profileRevision + ':' + model, String(value));
    },
    entityReference: vehicle => {
      const value = state(vehicle)[config.referenceKey];
      return value?.model === GetEntityModel(vehicle) && value.revision === config.profileRevision
        && validReference(value.referenceKmh) ? value : null;
    },
    writeEntityReference: (vehicle, value) => { state(vehicle).set(config.referenceKey, value, true); },
    readState: vehicle => { try { return state(vehicle)[config.stateKey] || null; } catch (_) { return null; } },
    writeState: (vehicle, value) => {
      try {
        state(vehicle).set(config.stateKey, value, true);
        const stored = state(vehicle)[config.stateKey];
        return value === null ? stored == null : stored?.token === value.token && stored?.expectedRatio === value.expectedRatio
          && stored?.previousRatio === value.previousRatio && stored?.backend === value.backend
          && stored?.rpmInfluenced === value.rpmInfluenced
          && sameState(stored?.wheelBrake ?? null, value.wheelBrake ?? null);
      } catch (_) { return false; }
    },
    recoveryVehicles: () => typeof GetGamePool === 'function' ? GetGamePool('CVehicle') : [],
    conflictingResource: () => config.conflictingResources.find(name => ['started', 'starting'].includes(GetResourceState(name))) || null,
    wheels: vehicle => {
      if (!['GetVehicleNumberOfWheels', 'GetVehicleWheelIsPowered', 'GetVehicleWheelSpeed'].every(name => typeof root[name] === 'function')) return [];
      const count = GetVehicleNumberOfWheels(vehicle);
      if (!Number.isInteger(count) || count < 1 || count > 32) return [];
      return Array.from({ length: count }, (_, index) => ({ index, powered: GetVehicleWheelIsPowered(vehicle, index), speedMps: GetVehicleWheelSpeed(vehicle, index) }));
    },
    driverPresent: vehicle => !!GetPedInVehicleSeat(vehicle, -1),
    brakeCapabilities: () => ['GetVehicleNumberOfWheels','GetVehicleWheelIsPowered',
      'GetVehicleWheelSpeed','GetVehicleHandlingFloat','GetVehicleWheelBrakePressure','SetVehicleWheelBrakePressure']
      .every(name => typeof root[name] === 'function'),
    brakeMissingCapabilities: () => ['GetVehicleNumberOfWheels','GetVehicleWheelIsPowered','GetVehicleWheelSpeed','GetVehicleHandlingFloat','GetVehicleWheelBrakePressure','SetVehicleWheelBrakePressure','GetVehicleWheelFlags','SetVehicleWheelFlags','GetVehicleHandbrake','SetVehicleHandbrake'].filter(name => typeof root[name] !== 'function'),
    wheelPowerObservation: (vehicle,index) => {try { const value=typeof GetVehicleWheelPower === 'function' ? GetVehicleWheelPower(vehicle,index) : null; return Number.isFinite(value)?value:null; }catch(_){return null;}},
    brakeRestoreCapabilities: () => ['GetVehicleWheelBrakePressure','SetVehicleWheelBrakePressure'].every(name => typeof root[name] === 'function'),
    lockCapabilities: () => ['GetVehicleWheelFlags','SetVehicleWheelFlags','GetVehicleHandbrake','SetVehicleHandbrake'].every(name => typeof root[name] === 'function'),
    wheelFlags: (vehicle,index) => GetVehicleWheelFlags(vehicle,index),
    setWheelFlags: (vehicle,index,value) => SetVehicleWheelFlags(vehicle,index,value),
    nativeHandbrake: vehicle => { const value=GetVehicleHandbrake(vehicle); if (![true,false,0,1].includes(value)) throw Error('Invalid handbrake state'); return bool(value); },
    setNativeHandbrake: (vehicle,value) => SetVehicleHandbrake(vehicle,value),
    wheelRotation: (vehicle,index) => diagnosticNative('GetVehicleWheelRotationSpeed',vehicle,index),
    wheelSpeed: (vehicle,index) => GetVehicleWheelSpeed(vehicle,index),
    brakePressure: (vehicle,index) => GetVehicleWheelBrakePressure(vehicle,index),
    setBrakePressure: (vehicle,index,value) => SetVehicleWheelBrakePressure(vehicle,index,value),
    brakeData: vehicle => {
      const count=GetVehicleNumberOfWheels(vehicle);
      if(!Number.isInteger(count)||count<1||count>32)return null;
      return {bias:GetVehicleHandlingFloat(vehicle,'CHandlingData','fDriveBiasFront'),
        wheels:Array.from({length:count},(_,index)=>({index,powered:bool(GetVehicleWheelIsPowered(vehicle,index)),
          power:api.wheelPowerObservation(vehicle,index),speedMps:GetVehicleWheelSpeed(vehicle,index)}))};
    },
    log: event => {
      if (config.debug || ['unsupported', 'restore_pending', 'suspended', 'final_ratio_transition', 'wheel_lock_diagnostic', 'wheel_lock_inhibited', 'rpm_cap_diagnostic', 'direction_transition', 'transmission_release'].includes(event.phase))
        console.log('[standalone_gearbox] ' + JSON.stringify({version:'0.3.0',...event}));
    }
  };
  const controller = new root.StandaloneGearboxController(api, config, catalogue);
  const access=root.StandaloneGearboxAccess.create(api,controller,config);
  const publicApi=root.StandaloneGearboxPublicApi.create(api,controller,data=>emit('standalone_gearbox:state',data),()=>access.allowed());
  onNet('standalone_gearbox:modeResponse',(nonce,netId,result)=>{if(Number(root.source)===65535)access.receive(nonce,netId,result);});
  let hud = { tick() {}, hide() {} };
  try { hud = root.StandaloneGearboxHud.create(api, controller, config, data => SendNuiMessage(JSON.stringify(data))); }
  catch (error) { console.error('[standalone_gearbox] HUD initialization: ' + String(error?.message || error)); }
  root.StandaloneGearbox = controller;
  const notify = message => {
    console.log('[standalone_gearbox] ' + message);
    BeginTextCommandThefeedPost('STRING'); AddTextComponentSubstringPlayerName(message); EndTextCommandThefeedPostTicker(false, false);
  };
  RegisterCommand(config.command, (_source, args) => {
    const option = String(args[0] || 'info').toLowerCase();
    if (['auto','seq','toggle'].includes(option)) { access.request(option); return; }
    if (option === 'up' || option === 'down') { controller.requestShift(option === 'up' ? 1 : -1); return; }
    if (option === 'info') { notify(JSON.stringify(controller.telemetry())); return; }
    notify(translate('usage'));
  }, false);
  RegisterCommand('+sgbox_up', () => controller.requestShift(1), false);
  RegisterCommand('-sgbox_up', () => {}, false);
  RegisterCommand('+sgbox_down', () => controller.requestShift(-1), false);
  RegisterCommand('-sgbox_down', () => {}, false);
  RegisterKeyMapping('+sgbox_up', translate('keyUp'), 'keyboard', config.upKey);
  RegisterKeyMapping('+sgbox_down', translate('keyDown'), 'keyboard', config.downKey);
  RegisterCommand('+sgbox_toggle',()=>access.request('toggle'),false);
  RegisterCommand('-sgbox_toggle',()=>{},false);
  RegisterKeyMapping('+sgbox_toggle',translate('keyToggle'),'keyboard',config.toggleKey);
  const trusted=()=>{const caller=typeof GetInvokingResource==='function'?GetInvokingResource():null;return !!caller&&config.trustedResources?.includes(caller);};
  exports('setMode', mode => trusted()?access.override(mode):access.request(mode));
  exports('requestMode', mode => access.request(mode));
  exports('shift', direction => controller.requestShift(direction));
  exports('suspend', key => trusted()?controller.suspend(key):false);
  exports('resume', key => trusted()?controller.resume(key):false);
  exports('getState', () => controller.telemetry());
  exports('getHudState', () => publicApi.state());
  exports('isReleased', () => controller.records.size === 0);
  // Remote-controlled RC vehicles do not contain the player's ped. Their own
  // control resource explicitly binds its local input target; never claim all
  // network-owned empty vehicles as if the player were driving them.
  exports('bindRemoteVehicle', vehicle => {
    const owner = typeof GetInvokingResource === 'function' ? GetInvokingResource() : null;
    if (!trusted() || !owner || (remoteBinding && remoteBinding.owner !== owner)) return false;
    if (!vehicle) { remoteBinding = null; return true; }
    if (!bool(DoesEntityExist(vehicle)) || !bool(NetworkHasControlOfEntity(vehicle))
      || GetPedInVehicleSeat(vehicle, -1) || !root.StandaloneGearboxLogic.landType(api.facts(vehicle))) return false;
    remoteBinding = { vehicle, model:GetEntityModel(vehicle), owner }; return true;
  });
  let errorReported = false;
  setTick(() => {
    try { access.tick(); } catch (_) {}
    try {
      controller.tick();
    } catch (error) {
      if (!errorReported) { console.error('[standalone_gearbox] runtime_exception: ' + String(error?.message || error)); errorReported = true; }
      // Keep the tick alive for recovery, without repeatedly attaching after a failure.
      try { controller.suspend('runtime_exception'); } catch (_) {}
    }
    try { publicApi.tick(); } catch (_) {}
    // A presentation error cannot suspend or alter the physical gearbox.
    try { hud.tick(); } catch (error) { try { hud.hide(); } catch (_) {} }
  });
  on('onClientResourceStop', resource => {
    if (resource === remoteBinding?.owner) remoteBinding = null;
    if (resource !== GetCurrentResourceName()) return;
    publicApi.stop();
    try { hud.hide(); SendNuiMessage(JSON.stringify({type:'gearboxShiftSoundStop'})); } catch (_) {}
    try {
      if (!controller.stop()) console.error('[standalone_gearbox] Recovery pending on entity state; restart the resource to retry. No vehicle was deleted.');
    } catch (error) { console.error('[standalone_gearbox] Stop recovery failed: ' + String(error?.message || error)); }
  });
})(globalThis);
