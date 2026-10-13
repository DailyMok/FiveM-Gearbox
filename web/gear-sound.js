'use strict';
(() => {
  const safeGain=volume=>Number.isFinite(volume)?Math.max(0,Math.min(.3,volume)):0;
  function controller(play,stop){
    let lastAt=-Infinity;
    return data=>{
      if(data?.type==='gearboxShiftSoundStop' || (data?.type==='gearboxHud' && data.visible===false)){stop();return false;}
      if(data?.type!=='gearboxShiftSound' || !Number.isInteger(data.from) || !Number.isInteger(data.to)
        || data.from<1 || data.from>24 || data.to<1 || data.to>24 || data.to===data.from
        || data.direction!==(data.to>data.from?'up':'down') || !Number.isFinite(data.atMs) || data.atMs<0 || data.atMs<=lastAt)return false;
      lastAt=data.atMs;play(data.direction,data.atMs,safeGain(data.volume));return true;
    };
  }
  if(typeof module!=='undefined' && module.exports)module.exports={controller,safeGain};
  if(typeof window==='undefined')return;
  const samples={up:{file:'GearUp.wav'},down:{file:'GearDown.wav'}};
  let context=null,active=null,reported=false;
  const buffers=new Map();
  const report=e=>{if(!reported){reported=true;console.warn('[Standalone gearbox audio] '+e.message);}};
  function init(){
    if(context)return;
    const Type=window.AudioContext || window.webkitAudioContext;
    if(!Type)throw new Error('Web Audio unavailable');
    context=new Type();
    for(const [name,sample] of Object.entries(samples))buffers.set(name,fetch('audio/'+sample.file)
      .then(r=>{if(!r.ok)throw new Error('Missing '+sample.file);return r.arrayBuffer();})
      .then(data=>context.decodeAudioData(data)).catch(e=>{report(e);return null;}));
  }
  function stop(){
    if(!active)return;
    try{active.source.stop();}catch{}
    active=null;
  }
  let serial=0, measured=0;
  async function play(name,atMs,volume){
    const generation=++serial;
    try{
      init();await context.resume();const buffer=await buffers.get(name);
      if(!buffer || generation!==serial)return;
      stop();const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
      // Admin100 = 30% amplitude; cap again at the actual WebAudio gain node.
      gain.gain.value=safeGain(volume);source.connect(gain);gain.connect(context.destination);active={source,gain};
      source.onended=()=>{source.disconnect();gain.disconnect();if(active?.source===source)active=null;};
      const duration=Math.min(.6,buffer.duration);source.start(0,0,duration);
      if(measured++<32)console.log('[Standalone gearbox shift] '+JSON.stringify({direction:name,commitAtMs:atMs,contextState:context.state,offset:0,duration,gain:gain.gain.value}));
    }catch(e){report(e);}
  }
  const handle=controller(play,()=>{serial++;stop();});
  window.addEventListener('message',e=>handle(e.data));
  // Load optional files only on the first sound request. Disabled audio needs no WAVs.
})();
