'use strict';
const el=id=>document.getElementById(id);
let lastTelemetry=0;
window.addEventListener('message',event=>{
  const data=event.data;
  if(data?.type!=='gearboxHud')return;
  const valid=data.visible===true && Number.isFinite(data.speed) && data.speed>=0
    && (['R','N','D'].includes(data.gear) || Number.isInteger(data.gear) && data.gear>0);
  el('race-banner').hidden=!valid;
  if(!valid)return;
  lastTelemetry=performance.now();
  const labels=data.labels||{};
  document.documentElement.lang=data.locale==='fr'?'fr':'en';
  el('f1-status').setAttribute('aria-label',labels.status||'Speed and current gear');
  el('gear-instrument').setAttribute('aria-label',labels.gear||'Current gear');
  el('speed').textContent=String(Math.round(data.speed));el('gear').textContent=String(data.gear);
  el('gear-mode').textContent=data.mode==='seq'?(labels.seq||'SEQ'):data.mode==='auto'?(labels.auto||'AUTO'):(labels.native||'NATIVE');
  const direction=['up','down'].includes(data.shiftHint) && Number.isInteger(data.gear) ? data.shiftHint : null;
  const arrow=el('shift-arrow');arrow.hidden=!direction;arrow.textContent=direction==='up'?'↑':direction==='down'?'↓':'';
  arrow.classList.toggle('up',direction==='up');arrow.classList.toggle('down',direction==='down');
  arrow.setAttribute('aria-label',direction==='up'?(labels.up||'Shift up'):direction==='down'?(labels.down||'Shift down'):(labels.shiftHint||'Shift advice'));
});
// An interrupted client tick must not leave a stale instrument on screen.
setInterval(()=>{if(performance.now()-lastTelemetry>1500)el('race-banner').hidden=true;},250);
