(function(root) {
  'use strict';
  // GTA wheel flag identified by ikt32/GTAVManualTransmission VehicleFlags.h.
  // Cfx exposes the uint16 field; 0x4 is not a documented Cfx compatibility promise.
  const BIT=0x4, uint16=x=>Number.isInteger(x)&&x>=0&&x<=65535;
  class DrivenLock {
    constructor(api,publish,canWrite){this.api=api;this.publish=publish;this.canWrite=canWrite;}
    static valid(j){return j==null||(j&&typeof j==='object'&&!Array.isArray(j)&&j.version===1&&j.asserted===true
      &&Number.isInteger(j.selected)&&j.selected>0&&j.selected<=24&&Array.isArray(j.indices)&&j.indices.length>0
      &&Array.isArray(j.wheels)&&j.wheels.length>0&&j.wheels.length<=32
      &&j.indices.every(i=>Number.isInteger(i)&&i>=0&&i<j.wheels.length)&&new Set(j.indices).size===j.indices.length
      &&j.wheels.every((w,i)=>w&&typeof w==='object'&&!Array.isArray(w)&&w.index===i&&uint16(w.originalFlags)
        &&w.appliedBit===(j.indices.includes(i)?BIT:0)));}
    input(record,sample){return record.wheelBrake?.nativeLock&&sample.handbrakeInput===false
      ?{...sample,handbrake:false}:sample;}
    available(){try{return this.api.lockCapabilities();}catch(_){return false;}}
    release(record){
      const s=record.wheelBrake,j=s.nativeLock,a=this.api,v=record.vehicle;if(!j)return true;
      s.nativeReleasing=true;
      if(!this.available()||!this.canWrite(record)){s.lockReason='native_lock_restore_unavailable';return false;}
      try{
        const sample=a.read(v),otherDriver=!a.isDriver(v)&&a.driverPresent?.(v);
        const priority=otherDriver||sample.handbrakeInput===true;
        // Stop our actuator before restoring eligibility. Never release a player's held brake.
        if(!priority&&a.nativeHandbrake(v)){a.setNativeHandbrake(v,false);if(a.nativeHandbrake(v))throw Error('release');}
        for(const w of j.wheels){
          if(!this.canWrite(record))throw Error('ownership');
          const flags=a.wheelFlags(v,w.index);if(!uint16(flags))throw Error('flags');
          const original=w.originalFlags&BIT;
          if((flags&BIT)===w.appliedBit&&(flags&BIT)!==original)a.setWheelFlags(v,w.index,(flags&~BIT)|original);
          const restored=a.wheelFlags(v,w.index);if(!uint16(restored)||(restored&BIT)!==original)throw Error('readback');
        }
        if(priority&&a.nativeHandbrake(v)){s.lockReason='native_lock_driver_release_wait';return false;}
        if(s.nativeReleaseRetryAt!=null&&a.now()<s.nativeReleaseRetryAt)return false;
        const oldLock=s.lock;s.nativeLock=null;s.lock=null;
        if(!this.publish(record)){s.nativeLock=j;s.lock=oldLock;s.nativeReleaseRetryAt=a.now()+100;s.lockReason='native_lock_release_publish_failed';return false;}
        s.nativeReleasing=false;s.nativeReleaseRetryAt=null;s.lockTrace=null;s.lastRotationAt=null;return true;
      }catch(_){s.lockReason='native_lock_restore_failed';return false;}
    }
    update(record,relativeExcess,now){
      const s=record.wheelBrake,a=this.api,v=record.vehicle;
      if(s.nativeReleasing){s.lockReason='native_lock_release_pending';return false;}
      if(!this.available()){s.lockReason='native_lock_natives_missing';return !s.nativeLock;}
      try{
        if(!s.nativeLock){
          const sample=a.read(v);
          if(sample.handbrakeInput||a.nativeHandbrake(v)){s.lockReason='external_handbrake_active';return false;}
          if(!this.canWrite(record,true))throw Error('ownership');
          const wheels=s.observedWheels.map(({index})=>({index,originalFlags:a.wheelFlags(v,index),appliedBit:s.confirmed.includes(index)?BIT:0}));
          const j={version:1,indices:[...s.confirmed],selected:record.selected,wheels,asserted:true};
          if(!DrivenLock.valid(j)||wheels.some(w=>!!(w.originalFlags&0x10)!==s.observedWheels[w.index].powered))throw Error('flags');
          s.nativeLock=j;s.lock={indices:[...j.indices],selected:j.selected};
          if(!this.publish(record)){s.nativeLock=null;s.lock=null;s.lockReason='native_lock_journal_failed';return false;}
          for(const w of wheels){
            if(!this.canWrite(record,true))throw Error('ownership');
            const flags=a.wheelFlags(v,w.index);if(!uint16(flags)||(flags&BIT)!==(w.originalFlags&BIT))throw Error('changed');
            if((flags&BIT)!==w.appliedBit)a.setWheelFlags(v,w.index,(flags&~BIT)|w.appliedBit);
          }
          if(now-(s.lastLockTrace??-Infinity)>=5000){s.lastLockTrace=now;s.lockTrace={started:now,next:0};}
        }
        const j=s.nativeLock;
        if(j.selected!==record.selected||!this.canWrite(record,true))throw Error('ownership');
        if(a.read(v).handbrakeInput)throw Error('driver');
        // Full batch verification precedes the native brake, including on later frames.
        for(const w of j.wheels){const flags=a.wheelFlags(v,w.index);if(!uint16(flags)||(flags&BIT)!==w.appliedBit)throw Error('mask_conflict');}
        s.rotationSamples=j.indices.map(index=>{
          let before=null,beforeSpeed=null;try{before=a.wheelRotation(v,index);}catch(_){}
          try{beforeSpeed=a.wheelSpeed(v,index);}catch(_){}
          const speed=record.observed?.forwardMps;
          return {index,before:Number.isFinite(before)?before:null,beforeSpeedMps:Number.isFinite(beforeSpeed)?beforeSpeed:null,
            beforeLongitudinalSlip:Number.isFinite(beforeSpeed)&&Number.isFinite(speed)&&Math.abs(speed)>1?(Math.abs(beforeSpeed)-Math.abs(speed))/Math.abs(speed):null,
            elapsedSincePreviousCommandMs:Number.isFinite(s.lastRotationAt)?now-s.lastRotationAt:null,atMs:now};
        });
        if(!this.canWrite(record,true))throw Error('ownership');
        const nativeBefore=a.nativeHandbrake(v);
        a.setNativeHandbrake(v,true);if(!a.nativeHandbrake(v))throw Error('handbrake_readback');
        s.lastRotationAt=now;s.lockReason='native_handbrake_commanded';
        const trace=s.lockTrace,delays=[0,250,1000];
        if(trace&&trace.next<delays.length&&now-trace.started>=delays[trace.next]){
          trace.next++;
          try{a.log({phase:'wheel_lock_diagnostic',actuator:'native_handbrake_mask',model:record.modelName,selected:record.selected,
            stage:trace.next,elapsedMs:now-trace.started,speedKmh:record.observed?.speedMps*3.6,capKmh:record.caps[record.selected-1],relativeExcess,
            handbrakeInput:a.read(v).handbrakeInput,nativeHandbrakeBefore:nativeBefore,nativeHandbrakeAfter:a.nativeHandbrake(v),
            routing:j.indices,rotationSamples:s.rotationSamples,readbackOnly:true,physicallyValidated:false});}catch(_){}
        }
        return true;
      }catch(_){s.lockReason='native_lock_write_or_readback_failed';return false;}
    }
  }
  root.StandaloneGearboxDrivenLock=DrivenLock;
})(globalThis);
