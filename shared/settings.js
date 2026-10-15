(function(root){
  'use strict';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
  const hash=v=>{const n=typeof v==='number'?v:/^-?\d+$/.test(String(v))?Number(v):NaN;return Number.isInteger(n)&&n>=-2147483648&&n<=4294967295?n>>>0:null;};
  function match(entries,model,name,hashName){
    const target=hash(model);let found=null;
    for(const [key,value] of Object.entries(entries||{})){
      const keyHash=hash(key);const same=keyHash!==null?keyHash===target:String(key).toLowerCase()===String(name).toLowerCase()||(hashName&&hash(hashName(String(key).toLowerCase()))===target);
      if(!same)continue;
      if(!value||typeof value!=='object'||Array.isArray(value))return {enabled:false,reason:'invalid_model_profile'};
      if(found&&JSON.stringify(found)!==JSON.stringify(value))return {enabled:false,reason:'duplicate_model_profile'};
      found=value;
    }
    return found;
  }
  function entry(facts,config,catalogue,profiles,hashName){
    const base=match(catalogue,facts.model,facts.modelName,null)||{};
    const explicit=match(profiles,facts.model,facts.modelName,hashName);
    const legacy=match(config.modelOverrides,facts.model,facts.modelName,hashName);
    const chosen={...base,...explicit,...legacy};
    if(chosen.enabled===false||chosen.passthrough===true)return {...chosen,passthrough:true,hideHud:true,reason:chosen.reason||'admin_model_excluded'};
    if(config.vehicleSelection==='selected'&&!(legacy?.enabled===true||explicit?.enabled===true))return {...chosen,passthrough:true,hideHud:true,reason:'admin_model_not_selected'};
    return chosen;
  }
  function apply(physics,admin){
    const c={...physics,shift:{...physics.shift},modelOverrides:{}};
    c.enabled=admin.enabled===true;c.showHud=admin.hud===true;c.vehicleSelection=admin.vehicles==='all'?'all':'selected';
    c.defaultMode=admin.defaultMode==='seq'?'seq':'auto';c.allowModeSwitch=admin.allowModeSwitch===true;
    c.locale=admin.locale==='fr'?'fr':'en';
    c.command=typeof admin.command==='string'&&/^[a-z0-9_]+$/i.test(admin.command)?admin.command:'sgbox';
    c.upKey=admin.keys?.up||'PAGEUP';c.downKey=admin.keys?.down||'PAGEDOWN';c.toggleKey=admin.keys?.toggle||'M';
    c.deviceKeys={mapper:admin.deviceKeys?.mapper??'JOYSTICK_BUTTON',up:admin.deviceKeys?.up??'',down:admin.deviceKeys?.down??'',toggle:admin.deviceKeys?.toggle??''};
    const percent=admin.shiftSounds?.volume;
    c.shiftFeedback={...physics.shiftFeedback,enabled:admin.shiftSounds?.enabled===true,volume:Number.isFinite(percent)?.3*Math.max(0,Math.min(100,percent))/100:0};
    c.trustedResources=Array.isArray(admin.trustedResources)?admin.trustedResources.filter(x=>typeof x==='string'&&x.length):[];
    c.conflictingResources=Array.isArray(admin.conflictingResources)?admin.conflictingResources.filter(x=>typeof x==='string'&&x.length):[];
    return c;
  }
  root.StandaloneGearboxSettings={apply,entry,hash,match};
})(globalThis);
