(function(root){
  'use strict';
  function allowed(source,policy,api){
    try{
      if(!policy||typeof policy!=='object')return false;
      if(policy.strategy==='everyone')return true;
      if(policy.strategy==='identifiers')return Array.isArray(policy.identifiers)&&api.identifiers(source).some(id=>typeof id==='string'&&policy.identifiers.includes(id));
      if(policy.strategy==='ace')return typeof policy.ace==='string'&&policy.ace.length>0&&api.ace(source,policy.ace)===true;
      if(policy.strategy!=='jobs')return false;
      const settings=policy.jobs;let job;
      if(settings?.adapter==='custom')job=policy.customJob(source);
      else if(settings?.adapter==='esx'){
        const name=settings.resource||'es_extended';if(!api.started(name))return false;
        const player=api.esx(name).GetPlayerFromId(source);job=player?.getJob();
        if(job)job={name:job.name,grade:job.grade,onDuty:job.onDuty};
      }else if(settings?.adapter==='qbcore'){
        const name=settings.resource||'qb-core';if(!api.started(name))return false;
        const player=api.qb(name).Functions.GetPlayer(source),data=player?.PlayerData?.job;
        if(data)job={name:data.name,grade:data.grade?.level,onDuty:data.onduty};
      }else return false;
      if(!job||typeof job.name!=='string'||!Number.isInteger(job.grade)||job.grade<0)return false;
      const rule=Object.prototype.hasOwnProperty.call(settings.allowed||{},job.name)?settings.allowed[job.name]:null;
      return !!rule&&Number.isInteger(rule.minGrade)&&rule.minGrade>=0&&job.grade>=rule.minGrade
        &&typeof rule.requireDuty==='boolean'&&(!rule.requireDuty||job.onDuty===true);
    }catch(_){return false;}
  }
  root.StandaloneGearboxPermissionCheck=allowed;
})(globalThis);
