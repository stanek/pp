/* ================================================================
 *  Web-MIDI connection + keyboard-range calibration
 * ===============================================================*/
let midiAccess=null, midiInput=null;
let rangeLow = Number.NEGATIVE_INFINITY, rangeHigh = Number.POSITIVE_INFINITY;

/* ---------- simple modal (inline-styled) ------------------------ */
function showModal(html){
  let ov=document.getElementById('calibOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='calibOverlay';
    Object.assign(ov.style,{
      position:'fixed',inset:0,background:'rgba(0,0,0,.45)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:10000,fontFamily:'system-ui'
    });
    const box=document.createElement('div'); box.id='calibBox';
    Object.assign(box.style,{
      background:'#fafafa',borderRadius:'12px',padding:'24px 32px',
      maxWidth:'290px',textAlign:'center',lineHeight:'1.4',
      boxShadow:'0 6px 24px rgba(0,0,0,.3)',color:'#111'
    });
    ov.appendChild(box); document.body.appendChild(ov);
  }
  document.getElementById('calibBox').innerHTML=html;
  ov.style.display='flex';
}
const hideModal = ()=>{ const o=$('calibOverlay'); if(o) o.style.display='none'; };

/* ---------- range tint helper ----------------------------------- */
function applyRangeTint(){
  document.querySelectorAll('.key').forEach(k=>{
    const midi = noteNameToMidi(k.dataset.note),
          avail = midi>=rangeLow && midi<=rangeHigh,
          idx = NOTES_LINEAR.indexOf(k.dataset.note);
    k.classList.toggle('available', avail);
    labelCells[idx].classList.toggle('availableCell', avail);
    keyTds  [idx].classList.toggle('availableCell', avail);
  });
}

/* ---------- calibration workflow -------------------------------- */
let calibActive=false, calibStage=0, tmpLow=null;
function startCalibration(auto){
  calibActive=true; calibStage=0; tmpLow=null;
  showModal(`<h2>Keyboard Calibration</h2>
             <p>Press the <strong>lowest note</strong> on your MIDI keyboard.</p>
             <p><small>This lets us highlight the exact range your instrument supports.</small></p>`);
  if(!auto) midiBtn.focus();
}
function finishCalibration(low,high){
  rangeLow=low; rangeHigh=high; calibActive=false; hideModal();
  applyRangeTint(); calibBtn.disabled=false;
}

/* ---------- MIDI plumbing --------------------------------------- */
function handleMIDI({data:[st,note,vel]}){
  const type=st&0xF0, name=midiToNoteName(note), velocity=vel/127;

  /* calibration taps */
  if(calibActive && type===0x90 && vel){
    if(calibStage===0){
      tmpLow=note; calibStage=1;
      showModal('<h2>Great!</h2><p>Now press the <strong>highest note</strong>.</p>');
    }else if(calibStage===1){
      finishCalibration(tmpLow, note);
    }
  }

  /* regular play-through */
  const div=piano.querySelector(`.key[data-note="${name}"]`);
  if(type===0x90 && vel){
    sampler.triggerAttack(name, Tone.now(), velocity);
    window.manualHeld.add(name);
    if(div) div.classList.add('held');
  }
  if((type===0x80) || (type===0x90 && vel===0)){
    sampler.triggerRelease(name, Tone.now());
    window.manualHeld.delete(name);
    if(div) div.classList.remove('held');
  }
}
async function connectMIDI(){
  try{ midiAccess = await navigator.requestMIDIAccess(); }
  catch{ alert('Web-MIDI access was denied'); return; }

  const inp=[...midiAccess.inputs.values()][0];
  if(!inp){ alert('No MIDI inputs detected'); return; }

  midiInput=inp;
  midiInput.addEventListener('midimessage', handleMIDI);
  midiAccess.addEventListener('statechange', e=>{
    if(e.port.type==='input' && e.port.state==='disconnected') disconnectMIDI();
  });

  midiBtn.textContent='Disconnect';
  midiBtn.style.background='#e65a4f';
  calibBtn.disabled=false;
  if(rangeLow===Number.NEGATIVE_INFINITY) startCalibration(true);
}
function disconnectMIDI(){
  if(midiInput) midiInput.removeEventListener('midimessage', handleMIDI);
  midiInput=null; midiAccess=null;
  midiBtn.textContent='Connect Piano'; midiBtn.style.background='green';
  calibBtn.disabled=true;
  document.querySelectorAll('.available').forEach(n=>n.classList.remove('available'));
  document.querySelectorAll('.availableCell').forEach(n=>n.classList.remove('availableCell'));
}

/* button hooks */
midiBtn.onclick  = ()=> midiInput ? disconnectMIDI() : connectMIDI();
calibBtn.onclick = ()=> startCalibration(false);
window.addEventListener('beforeunload', disconnectMIDI);
