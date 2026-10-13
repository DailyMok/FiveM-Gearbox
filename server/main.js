(function(root){
  'use strict';
  const required=['GetGameTimer','GetNumPlayerIdentifiers','GetPlayerIdentifier','IsPlayerAceAllowed','GetResourceState','GetPlayerPed','NetworkGetEntityFromNetworkId','DoesEntityExist','GetEntityType','GetPedInVehicleSeat','NetworkGetNetworkIdFromEntity','GetPlayerRoutingBucket','GetEntityRoutingBucket','GetEntityModel','GetHashKey','onNet','on','emitNet'];
  const missing=required.filter(name=>typeof root[name]!=='function');
  if(missing.length){console.log('[standalone_gearbox] Mode permissions unavailable: '+missing.join(', '));return;}
  console.log('[standalone_gearbox] Mode permissions ready');
  const config=root.StandaloneGearboxConfig,settings=root.StandaloneGearboxSettings,modes=new Map(),rates=new Map();
  const permissionApi={identifiers:s=>Array.from({length:GetNumPlayerIdentifiers(String(s))},(_,i)=>GetPlayerIdentifier(String(s),i)),ace:(s,a)=>IsPlayerAceAllowed(String(s),a)===true||IsPlayerAceAllowed(String(s),a)===1,
    started:r=>GetResourceState(r)==='started',esx:r=>exports[r].getSharedObject(),qb:r=>exports[r].GetCoreObject()};
  const permitted=s=>config.allowModeSwitch===true&&root.StandaloneGearboxPermissionCheck(s,root.StandaloneGearboxPermissions,permissionApi);
  function vehicle(source,netId){
    const ped=GetPlayerPed(String(source));if(!ped)return 0;
    const v=NetworkGetEntityFromNetworkId(netId);if(!v||!DoesEntityExist(v)||GetEntityType(v)!==2||GetPedInVehicleSeat(v,-1)!==ped||NetworkGetNetworkIdFromEntity(v)!==netId)return 0;
    if(GetPlayerRoutingBucket(String(source))!==GetEntityRoutingBucket(v))return 0;return v;
  }
  onNet('standalone_gearbox:modeRequest',(nonce,netId,action)=>{
    const source=Number(root.source);
    if(!Number.isInteger(source)||source<=0||typeof nonce!=='string'||nonce.length<1||nonce.length>96||!Number.isInteger(netId)||netId<=0||!['sync','toggle','auto','seq'].includes(action))return;
    const now=GetGameTimer(),previous=rates.get(source);if(previous!=null&&now>=previous&&now-previous<100)return;rates.set(source,now);
    let result={ok:false,reason:'unavailable',canSwitch:false};
    try{
      const v=vehicle(source,netId);if(!v||!config.enabled)throw Error('driver');
      const model=GetEntityModel(v),profile=settings.entry({model,modelName:''},config,{},root.StandaloneGearboxVehicleProfiles,GetHashKey);
      if(profile.passthrough)throw Error('excluded');
      let saved=modes.get(v);
      if(!saved||saved.model!==model||saved.netId!==netId){saved={model,netId,mode:profile.defaultMode==='seq'?'seq':profile.defaultMode==='auto'?'auto':config.defaultMode,revision:0};modes.set(v,saved);}
      const canSwitch=permitted(source);
      if(action!=='sync'&&!canSwitch)result={ok:false,reason:'denied',canSwitch:false};
      else{
        if(action!=='sync'){saved.mode=action==='toggle'?(saved.mode==='auto'?'seq':'auto'):action;saved.revision++;}
        result={ok:true,mode:saved.mode,model:settings.hash(model),revision:saved.revision,canSwitch};
      }
    }catch(_){}
    emitNet('standalone_gearbox:modeResponse',source,nonce,netId,result);
  });
  on('entityRemoved',entity=>modes.delete(entity));
  on('playerDropped',()=>rates.delete(Number(root.source)));
  // Modes are deliberately not saved by plate/model or restored after resource restart.
})(globalThis);
