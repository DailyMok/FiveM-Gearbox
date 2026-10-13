(function(root) {
  'use strict';
  const L=root.StandaloneGearboxLogic, clone=value=>JSON.parse(JSON.stringify(value));
  const pressure=value=>L.finite(value)&&value>=0&&value<=100;
  // Stricter than ratio tolerance: never erase a visibly different brake writer.
  const same=(a,b)=>L.finite(a)&&L.finite(b)&&Math.abs(a-b)<=0.00001;
  class WheelBrake {
    constructor(api,config,publish){this.api=api;this.config=config;this.publish=publish;this.drivenLock=new root.StandaloneGearboxDrivenLock(api,publish,(r,d)=>this.canWrite(r,d));}
    state(record){return record.wheelBrake||(record.wheelBrake={owned:[],phase:'waiting',reason:'powered_flags_stability_wait',confirmed:[],samples:{},demand:0,lastAt:null,lastWrite:-Infinity,signature:null});}
    ledger(record){const s=this.state(record);return s.owned.length||s.lock||s.nativeLock?{version:1,owned:clone(s.owned),...(s.lock?{lock:clone(s.lock)}:{}),...(s.nativeLock?{nativeLock:clone(s.nativeLock)}:{})}:null;}
    valid(value){return value==null || (typeof value==='object'&&!Array.isArray(value)&&value.version===1&&Array.isArray(value.owned)&&value.owned.length<=32
      &&value.owned.every(e=>e&&typeof e==='object'&&!Array.isArray(e))
      &&(value.lock==null||(typeof value.lock==='object'&&!Array.isArray(value.lock)&&Number.isInteger(value.lock.selected)&&value.lock.selected>0&&value.lock.selected<=24
        &&Array.isArray(value.lock.indices)&&value.lock.indices.length>0&&value.lock.indices.length<=32&&value.lock.indices.every(i=>Number.isInteger(i)&&i>=0&&i<32)&&new Set(value.lock.indices).size===value.lock.indices.length))
      &&root.StandaloneGearboxDrivenLock.valid(value.nativeLock)
      &&(!value.nativeLock||(value.lock&&value.lock.selected===value.nativeLock.selected&&JSON.stringify(value.lock.indices)===JSON.stringify(value.nativeLock.indices)))
      &&new Set(value.owned.map(e=>e.index)).size===value.owned.length
      &&value.owned.every(e=>Number.isInteger(e.index)&&e.index>=0&&e.index<32&&pressure(e.base)&&pressure(e.last)&&e.last>=e.base
        &&(e.previous==null||pressure(e.previous))));}
    adopt(record,value){if(value?.owned)this.state(record).owned=clone(value.owned);if(value?.lock)this.state(record).lock=clone(value.lock);if(value?.nativeLock)this.state(record).nativeLock=clone(value.nativeLock);}
    available(){try{return typeof this.api.brakeData==='function'&&typeof this.api.brakePressure==='function'
      &&typeof this.api.setBrakePressure==='function'&&this.api.brakeCapabilities();}catch(_){return false;}}
    restoreAvailable(){try{return typeof this.api.brakePressure==='function'&&typeof this.api.setBrakePressure==='function'
      &&this.api.brakeRestoreCapabilities();}catch(_){return false;}}
    configured(){const c=this.config.engineBrake;return c&&['maxPressure','pressurePerRelativeExcess','risePerSecond','risePerRelativeExcess','fallPerSecond','updateMs',
      'observeThrottle','observeMinSpeedMps','powerEpsilon','observeSamples','observeSpacingMs','observeMinMs'].every(k=>L.positive(c[k]))
      &&L.finite(c.entryKmh)&&c.entryKmh>=0&&c.maxPressure<=10&&c.updateMs>=50&&c.observeSamples>=2;}
    canWrite(record,driver=false){const a=this.api,v=record.vehicle;return a.exists(v)&&a.model(v)===record.model
      &&a.controlled(v)&&a.readState(v)?.token===record.token&&(!driver||a.isDriver(v));}
    release(record,reason='released',keepLock=false) {
      const s=this.state(record),api=this.api,v=record.vehicle;s.demand=0;s.targetPressure=0;if(!keepLock)s.relativeExcess=null;s.reason=reason;s.phase='idle';
      if(!keepLock&&!this.drivenLock.release(record)){s.phase='restore_pending';s.reason=s.lockReason;return false;}
      if(!s.owned.length&&(!s.lock||keepLock))return true;
      s.phase='restore_pending';
      if(!this.canWrite(record)||(s.owned.length&&!this.restoreAvailable())){s.reason='wheel_brake_restore_unavailable';return false;}
      let input;try{input=this.drivenLock.input(record,api.read(v));}catch(_){s.reason='wheel_brake_restore_read_failed';return false;}
      // During driver braking, an unchanged pressure may already be the game's
      // own request. Wait for a distinguishable native update instead of zeroing it.
      const driverPriority=(api.isDriver(v)&&(input.brake>0.001||input.handbrake===true))
        ||(!api.isDriver(v)&&api.driverPresent?.(v));
      const remaining=[];
      for(const e of s.owned){
        try{
          const current=api.brakePressure(v,e.index);
          if(!pressure(current)){remaining.push(e);continue;}
          if(!same(current,e.last)&&!same(current,e.previous))continue; // Native/external writer owns this newer value.
          if(same(current,e.base))continue;
          if(driverPriority){remaining.push(e);continue;}
          if(!this.canWrite(record)||(!api.isDriver(v)&&api.driverPresent?.(v))){remaining.push(e);continue;}
          api.setBrakePressure(v,e.index,e.base);
          if(!same(api.brakePressure(v,e.index),e.base))remaining.push(e);
        }catch(_){remaining.push(e);}
      }
      const before=s.owned, previousLock=s.lock, changed=(!keepLock&&!!previousLock)||JSON.stringify(before)!==JSON.stringify(remaining);
      // Waiting on driver/native pressure does not publish an unchanged bag.
      // Failed publication retries are bounded too, while ownership stays live.
      if(changed||s.releaseDirty){
        if(s.releaseDirty&&api.now()<(s.releaseRetryAt??0))return false;
        s.owned=remaining;s.lock=keepLock?previousLock:null;
        if(!this.publish(record)){s.owned=before;s.lock=previousLock;s.releaseDirty=true;s.releaseRetryAt=api.now()+100;s.reason='wheel_brake_release_publish_failed';return false;}
        s.releaseDirty=false;
      }
      s.phase=remaining.length?'restore_pending':'idle';
      s.reason=remaining.length?'wheel_brake_release_waiting':reason;
      return !remaining.length;
    }
    rotation(record,overspeed,relativeExcess,now) {
      const s=this.state(record),c=this.config.engineBrake;
      if(!c.lockEnabled){s.lockReason='native_lock_disabled';return !s.lock;}
      if(!L.positive(c.lockRelativeExcess)||c.lockRelativeExcess>2){s.lockReason='invalid_lock_configuration';return !s.lock;}
      if(!s.lock&&(overspeed<=c.entryKmh||relativeExcess<c.lockRelativeExcess))return true;
      return this.drivenLock.update(record,relativeExcess,now);
    }
    observe(record,sample,now) {
      const s=this.state(record),c=this.config.engineBrake;
      if(c?.enabled&&!this.configured()){s.reason='wheel_brake_configuration_invalid';return null;}
      if(!c?.enabled||!this.available()){s.reason=c?.enabled?'wheel_brake_natives_missing':'disabled';return null;}
      let data;try{data=this.api.brakeData(record.vehicle);}catch(_){s.reason='wheel_data_unavailable';return null;}
      s.observedWheels=data?.wheels??[];s.observedBias=data?.bias??null;s.observationsAt=now;
      if(!data||!L.finite(data.bias)||data.bias<0||data.bias>1||!Array.isArray(data.wheels)||!data.wheels.length||data.wheels.length>32
        ||data.wheels.some((w,i)=>!w||w.index!==i||typeof w.powered!=='boolean'||!L.finite(w.speedMps))){s.reason='wheel_data_invalid';return null;}
      const signature=JSON.stringify([data.bias,data.wheels.map(w=>w.powered)]);
      if(signature!==s.signature){
        if(!this.release(record,'drive_configuration_changed'))return null;
        s.signature=signature;s.confirmed=[];s.samples={};s.bias=data.bias;s.routingContradiction=false;
      }
      // The documented powered flag is the routing source. WheelPower is an
      // instantaneous float with no documented unit/sign contract: zero or a
      // negative reading must not disable a flagged wheel.
      const observing=record.phase==='active'&&sample.engineRunning&&sample.forwardMps>0
        &&sample.speedMps>=c.observeMinSpeedMps&&!sample.inAir&&!sample.handbrake&&!record.pending;
      const traction=observing&&sample.throttle>=c.observeThrottle&&sample.brake<=0.001&&!record.limiter?.cutting;
      if(traction&&data.wheels.some(w=>L.finite(w.power)&&w.power>c.powerEpsilon&&!w.powered)){
        s.routingContradiction=true;s.reason='wheel_power_flag_contradiction';s.confirmed=[];s.samples={};return null;
      }
      if(s.routingContradiction){s.reason='wheel_power_flag_contradiction';return null;}
      if(!data.wheels.some(w=>w.powered)){s.reason='no_powered_wheel_flags';s.confirmed=[];s.samples={};return null;}
      // Powered is a permission flag: an exclusive axle bias can still leave
      // every wheel flagged. No wheel-index -> axle mapping is assumed.
      if((data.bias===0||data.bias===1)&&data.wheels.every(w=>w.powered)){
        s.routingSource='ambiguous_powered_flags';s.reason='powered_flags_axle_ambiguous';s.confirmed=[];s.samples={};return null;
      }
      if(observing){
        for(const w of data.wheels){
          if(!w.powered)continue;
          const history=s.samples[w.index]||(s.samples[w.index]={count:0,first:now,last:-Infinity});
          if(now-history.last>=c.observeSpacingMs){history.count++;history.last=now;}
          if(history.count>=c.observeSamples&&now-history.first>=c.observeMinMs&&!s.confirmed.includes(w.index))s.confirmed.push(w.index);
        }
      }
      s.routingSource='stable_powered_flags';
      s.confirmed.sort((a,b)=>a-b);s.wheelSpeeds=data.wheels.map(w=>({index:w.index,speedMps:w.speedMps}));
      if(!s.confirmed.length)s.reason='powered_flags_stability_wait';
      return data;
    }
    diagnose(record,sample,now,reason) {
      const s=this.state(record),cap=record.caps?.[record.selected-1],c=this.config.engineBrake;
      const r=L.positive(cap)?(sample.speedMps*3.6-cap)/cap:0;
      // A pending shift must not hide a journal/native failure on the next tick.
      // Two fixed buckets, at most two inhibition lines in any five seconds.
      const bucket=reason==='shift_in_progress'?'transition':'intervention';
      s.inhibitedTraceAt ||= {};
      if(!c?.enabled||record.selected>=record.table.length||!L.finite(r)||r<(c.lockRelativeExcess??.25)
        ||now-(s.inhibitedTraceAt[bucket]??-Infinity)<5000)return;
      s.inhibitedTraceAt[bucket]=now;
      try{this.api.log({phase:'wheel_lock_inhibited',model:record.modelName,selected:record.selected,reason,
        speedKmh:sample.speedMps*3.6,capKmh:cap,relativeExcess:r,routingSource:s.routingSource??null,
        bias:s.observedBias??null,observationsAt:s.observationsAt??null,wheels:s.observedWheels??[],confirmed:s.confirmed,
        stabilitySamples:Object.entries(s.samples).map(([index,h])=>({index:Number(index),count:h.count})),
        gate:{engine:sample.engineRunning,forward:sample.forwardMps,air:sample.inAir,handbrake:sample.handbrake,
          brake:sample.brake,pending:!!record.pending,driver:this.api.isDriver(record.vehicle),controlled:this.api.controlled(record.vehicle)},
        missingNatives:this.api.brakeMissingCapabilities?.()??[],readbackOnly:true});}catch(_){}
    }
    update(record,sample,now,mode) {
      const s=this.state(record),c=this.config.engineBrake,api=this.api,v=record.vehicle;
      sample=this.drivenLock.input(record,sample);
      const delta=s.lastAt==null?0:now-s.lastAt;s.lastAt=now;
      const data=this.observe(record,sample,now);
      const safe=c?.enabled&&data&&s.confirmed.length&&record.phase==='active'&&api.controlled(v)&&api.isDriver(v)
        &&sample.engineRunning&&sample.forwardMps>0&&!sample.inAir&&!sample.handbrake
        &&!record.pending&&record.selected<record.table.length&&!(mode==='auto'&&record.profile.strategy==='cvt');
      if(!safe||delta<0||delta>this.config.shift.maxGapMs){
        const reason=!data?s.reason:record.phase!=='active'?'gearbox_not_active':!api.controlled(v)?'network_control_lost'
          :!api.isDriver(v)?'driver_not_current':!sample.engineRunning?'engine_stopped':delta<0||delta>this.config.shift.maxGapMs?'tick_gap'
          :sample.forwardMps<=0?'not_forward':sample.inAir?'airborne':sample.handbrake?'handbrake_priority'
          :record.pending?'shift_in_progress':record.selected===record.table.length?'last_gear_unbounded'
          :mode==='auto'&&record.profile.strategy==='cvt'?'cvt_auto':!s.confirmed.length?'powered_flags_stability_wait':'inactive';
        this.diagnose(record,sample,now,reason);this.release(record,reason);return;
      }
      const cap=record.caps[record.selected-1],overspeed=sample.speedMps*3.6-cap;s.overspeedKmh=overspeed;
      const relativeExcess=Math.max(0,overspeed/cap);s.relativeExcess=relativeExcess;
      if(overspeed<=0){this.release(record,'within_gear_range');return;}
      // Foot braking does not undo the requested driveline lock. Native brake
      // pressures stay driver-owned: only the native masked brake is maintained.
      if(sample.brake>0.001){
        if(!this.rotation(record,overspeed,relativeExcess,now)){this.diagnose(record,sample,now,s.lockReason);this.release(record,s.lockReason);return;}
      if(!s.lock)this.diagnose(record,sample,now,s.lockReason||s.reason);
        this.release(record,'driver_pressure_priority',true);return;
      }
      if(s.phase==='restore_pending'&&!this.release(record,'release_retry',true)){this.diagnose(record,sample,now,'pressure_restore_pending');return;}
      const target=overspeed>c.entryKmh?Math.min(c.maxPressure,relativeExcess*c.pressurePerRelativeExcess):0;
      s.targetPressure=target;
      const rise=c.risePerSecond+c.risePerRelativeExcess*Math.min(relativeExcess,1);
      const step=(target>s.demand?rise:c.fallPerSecond)*delta/1000;
      s.demand=target>s.demand?Math.min(target,s.demand+step):Math.max(target,s.demand-step);
      // No residual braking once back inside the selected gear's range.
      if(overspeed<=0){this.release(record,'within_gear_range');return;}
      if(!this.rotation(record,overspeed,relativeExcess,now)){this.diagnose(record,sample,now,s.lockReason);this.release(record,s.lockReason);return;}
      if(!s.lock)this.diagnose(record,sample,now,s.lockReason||s.reason);
      if(s.demand<=0.00001&&!s.lock){this.release(record,'within_gear_range');return;}
      s.phase='active';s.reason='intermediate_overspeed';
      if(now-s.lastWrite<c.updateMs){
        // Some builds recompute native pressure every physics frame. Reassert
        // only the ALREADY journalled target when the reading is its known
        // baseline/previous value; no publication and no accumulation here.
        try{for(const e of s.owned){const current=api.brakePressure(v,e.index);
          if(!pressure(current))throw Error('pressure');
          if(current<e.last&&(same(current,e.base)||same(current,e.previous))){
            if(!this.canWrite(record,true))throw Error('ownership');
            api.setBrakePressure(v,e.index,e.last);if(!same(api.brakePressure(v,e.index),e.last))throw Error('readback');
          }
        }}catch(_){this.diagnose(record,sample,now,'wheel_brake_maintain_failed');this.release(record,'wheel_brake_maintain_failed');}
        return;
      }
      const plans=[],owned=[];
      try{
        for(const index of s.confirmed){
          const current=api.brakePressure(v,index);if(!pressure(current))throw Error('pressure');
          const old=s.owned.find(e=>e.index===index);
          const ours=old&&(same(current,old.last)||same(current,old.previous));
          const base=ours?old.base:current,targetPressure=Math.max(base,s.demand);
          if(same(targetPressure,base)&&!ours)continue;
          if(ours&&same(current,targetPressure)){owned.push(old);continue;}
          const entry={index,base,last:targetPressure,previous:current};owned.push(entry);
          if(!same(current,targetPressure))plans.push(entry);
        }
        if(!plans.length&&JSON.stringify(s.owned)===JSON.stringify(owned)){s.lastWrite=now;return;}
        const before=s.owned;s.owned=owned;
        // One journal publication per pressure update, not per wheel/frame.
        // Both pre/post-write values permit recovery from any partial batch.
        if(!this.publish(record)){s.owned=before;throw Error('journal');}
        s.lastWrite=now;
        for(const e of plans){if(!this.canWrite(record,true))throw Error('ownership');api.setBrakePressure(v,e.index,e.last);if(!same(api.brakePressure(v,e.index),e.last))throw Error('readback');}
      }catch(_){this.diagnose(record,sample,now,'wheel_brake_write_failed');this.release(record,'wheel_brake_write_failed');}
    }
    telemetry(record){if(!record)return null;const s=this.state(record);
      // Read back now, separately from the journalled demand: a target is not
      // proof that GTA still applies it. Diagnostic getter failures are isolated.
      const observedPressures=[...new Set([...s.confirmed,...s.owned.map(e=>e.index)])].map(index=>{
        let value=null;try{if(this.api.exists(record.vehicle)&&this.api.model(record.vehicle)===record.model){const read=this.api.brakePressure(record.vehicle,index);if(pressure(read))value=read;}}catch(_){}
        return {index,pressure:value};
      });
      return {phase:s.phase,reason:s.reason,confirmedPoweredWheels:s.confirmed,
      routingSource:s.routingSource??null,observedWheels:s.observedWheels??[],driveBiasFront:s.bias??null,demandPressure:s.demand,targetPressure:s.targetPressure??0,relativeExcess:s.relativeExcess??null,
      observedPressures,overspeedKmh:s.overspeedKmh??null,
      lockActuator:s.nativeLock?'native_handbrake_mask':null,nativeHandbrakeOwned:!!s.nativeLock,angularLockActive:!!s.lock,angularLockIndices:s.lock?.indices??[],angularLockReason:s.lockReason??null,rotationSamples:s.rotationSamples??[],
      ownedPressures:clone(s.owned),wheelSpeeds:s.wheelSpeeds??[],physicallyValidated:false};}
  }
  root.StandaloneGearboxWheelBrake=WheelBrake;
})(globalThis);
