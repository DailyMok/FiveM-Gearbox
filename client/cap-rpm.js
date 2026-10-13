(function(root){
  'use strict';
  const L=root.StandaloneGearboxLogic, near=(a,b)=>L.finite(a)&&L.finite(b)&&Math.abs(a-b)<0.0001;
  class CapRpm {
    constructor(api,config,publish){this.api=api;this.config=config;this.publish=publish;}
    state(record){return record.capRpm||(record.capRpm={active:false,reason:'inactive',lastWrite:null,lastTrace:-Infinity});}
    sample(record,sample){
      const s=this.state(record),elapsed=this.api.now()-(s.lastWrite??-Infinity);
      // The RPM setter also changes the getter. Do not interpret our own value
      // as a new engine observation for automatic shifts or HUD advice.
      if(elapsed>=0&&elapsed<=this.config.shift.maxGapMs&&near(sample.rpm,s.requested)
        &&L.positive(s.referenceSpeed)&&L.positive(s.referenceRatio)&&L.finite(s.referenceRpm)){
        const estimate=s.referenceRpm*sample.speedMps/s.referenceSpeed*record.expectedRatio/s.referenceRatio;
        if(L.finite(estimate)&&estimate>=0)return {...sample,decisionRpm:estimate,decisionRpmEstimated:true};
      }
      return sample;
    }
    stop(record,reason){const s=this.state(record);s.active=false;s.reason=reason;}
    update(record,sample,now,mode){
      const s=this.state(record),c=this.config.capRpm,api=this.api,v=record.vehicle,cap=record.caps[record.selected-1];
      const configured=c&&L.finite(c.target)&&c.target>=.8&&c.target<=1&&L.positive(c.startFraction)&&c.startFraction<1;
      const eligible=configured&&c.enabled&&record.phase==='active'&&record.selected<record.table.length&&!record.pending
        &&sample.engineRunning&&!sample.inAir&&sample.forwardMps>0&&sample.throttle>.1&&sample.brake<=.001&&!sample.handbrake
        &&!record.wheelBrake?.lock&&record.profile.strategy!=='electric_steps'&&!(mode==='auto'&&record.profile.strategy==='cvt')
        &&L.positive(cap)&&sample.speedMps*3.6>=cap*c.startFraction;
      if(!eligible){this.stop(record,'outside_cap_rpm_conditions');return;}
      try{
        if(!api.rpmCapabilities()){this.stop(record,'rpm_native_missing');return;}
        if(!api.exists(v)||api.model(v)!==record.model||!api.controlled(v)||!api.isDriver(v)||api.readState(v)?.token!==record.token){this.stop(record,'rpm_ownership_lost');return;}
        if(!s.active||!sample.decisionRpmEstimated){s.referenceRpm=sample.decisionRpm??sample.rpm;s.referenceSpeed=sample.speedMps;s.referenceRatio=record.expectedRatio;}
        // Mark this transient influence before the first write. No RPM baseline
        // is replayed on release/restart: it is a changing engine state.
        if(!record.rpmInfluenced){record.rpmInfluenced=true;if(!this.publish(record)){record.rpmInfluenced=false;this.stop(record,'rpm_journal_failed');return;}}
        const previousActive=s.active;
        s.before=sample.rpm;s.requested=Math.max(sample.rpm,c.target);
        if(s.requested>1){this.stop(record,'native_rpm_above_target');return;}
        api.setRpm(v,s.requested);s.lastWrite=now;s.after=api.rpm(v);
        s.active=near(s.after,s.requested);s.reason=s.active?'cap_rpm_maintained':'rpm_readback_failed';
        if(!previousActive&&now-s.lastTrace>=5000){s.lastTrace=now;api.log({phase:'rpm_cap_diagnostic',model:record.modelName,selected:record.selected,
          speedKmh:sample.speedMps*3.6,capKmh:cap,before:s.before,requested:s.requested,after:s.after,readbackOnly:true});}
      }catch(_){this.stop(record,'rpm_write_or_read_failed');}
    }
    telemetry(record){if(!record)return null;const s=this.state(record);return {active:s.active,reason:s.reason,before:s.before??null,
      requested:s.requested??null,after:s.after??null,decisionRpmEstimated:!!record.observed?.decisionRpmEstimated,
      actualPhysicsAndAudioValidated:false};}
  }
  root.StandaloneGearboxCapRpm=CapRpm;
})(globalThis);
