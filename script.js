/* ==================================================================
 *  Playable-Piano – FULL script.js (July 2025)
 *  — Sequencer + Tone.js Sampler + Web-MIDI + Calibration —
 * =================================================================*/

/* ------------------------------------------------------------------
 * CONFIGURATION
 * ----------------------------------------------------------------*/
const MAX_WS = 10;
const OCTAVES      = [2,3,4,5];                               // onscreen octaves
const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLE_ROOTS = ['A','C','D#','F#'];                     // samples we load
const ROWS = 200;
const COLS = OCTAVES.length * NOTE_NAMES.length;
const CELL_PX = 26;                                           // grid cell size
const ROW_PX  = CELL_PX + 1;                                  // incl. collapsed brd
const PREVIEW_DUR = 0.25;                                     // sec
const STORE_KEY   = 'pianoSequencerWorkspaces';

/* ------------------------------------------------------------------
 * GLOBAL STATE (sets used in multiple sections)
 * ----------------------------------------------------------------*/
const manualHeld   = new Set();       // notes currently held via mouse or MIDI
const ongoingHeld  = new Set();       // notes we triggered via MIDI so we can release

/* ------------------------------------------------------------------
 * DOM SHORTCUTS & TRANSPORT BAR CONTROLS
 * ----------------------------------------------------------------*/
const $=id=>document.getElementById(id);
const piano=$('piano'), grid=$('grid'), transport=$('transport');
const playB=$('playBtn'), pauseB=$('pauseBtn'), stopB=$('stopBtn');
const tempo=$('tempo'), tonicSel=$('tonicSelect'), modeSel=$('modeSelect');
const addBtn=$('addWS'), tabsBox=$('tabs'), modeDrop=$('playMode');

/* ---------- Connect / Calibrate buttons (inject if not present) -- */
const midiBtn  = $('midiBtn') || Object.assign(document.createElement('button'),
                    {id:'midiBtn',textContent:'Connect Piano',style:'background:green'});
const calibBtn = $('calibBtn')|| Object.assign(document.createElement('button'),
                    {id:'calibBtn',textContent:'Calibrate',disabled:true});
if(!midiBtn.parentNode)  transport.prepend(midiBtn);
if(!calibBtn.parentNode) transport.insertBefore(calibBtn, midiBtn.nextSibling);

/* ------------------------------------------------------------------
 * STATIC PIANO & GRID CONSTRUCTION
 * ----------------------------------------------------------------*/
const labelCells=[], keySpans=[];
(function buildUI(){
  const rOct=piano.insertRow(), rLab=piano.insertRow(), rKey=piano.insertRow();
  OCTAVES.forEach(o=>{
    const oc=rOct.insertCell(); oc.colSpan=NOTE_NAMES.length; oc.textContent=o; oc.className='octave';
    NOTE_NAMES.forEach(n=>{
      /* labels row */
      const lab=rLab.insertCell(); lab.className='note'; labelCells.push(lab);
      /* key row */
      const kc=rKey.insertCell();
      const div=document.createElement('div');
      div.className=`key ${n.includes('#')?'black':'white'}`; div.dataset.note=n+o;
      const span=document.createElement('span'); span.className='botlabel'; div.appendChild(span);
      kc.appendChild(div); keySpans.push(span);
    });
  });
  /* grid */
  for(let r=0;r<ROWS;r++){ const row=grid.insertRow(); for(let c=0;c<COLS;c++) row.insertCell(); }
})();

/* ------------------------------------------------------------------
 * NOTE HELPERS
 * ----------------------------------------------------------------*/
const pcOf=n=>({C:0,'B#':0,'C#':1,'Db':1,D:2,'D#':3,'Eb':3,E:4,'Fb':4,'E#':5,
F:5,'F#':6,'Gb':6,G:7,'G#':8,'Ab':8,A:9,'A#':10,'Bb':10,B:11,'Cb':11}[n]);
const NOTES_LINEAR = OCTAVES.flatMap(o=>NOTE_NAMES.map(n=>n+o));
const NAT_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJ=[0,2,4,5,7,9,11], MIN=[0,2,3,5,7,8,10];

const noteNameToMidi = n => {
  const m = n.match(/^([A-G]#?)(\d+)$/); return (+m[2]+1)*12 + NOTE_NAMES.indexOf(m[1]);
};
const midiToNoteName = n => NOTE_NAMES[n%12] + (Math.floor(n/12)-1);

/* ------------------------------------------------------------------
 * AUDIO – Tone.js Sampler
 * ----------------------------------------------------------------*/
const sampler=new Tone.Sampler({
  urls:Object.fromEntries(
    OCTAVES.flatMap(o=>SAMPLE_ROOTS.map(n=>[`${n}${o}`, n.replace('#','s')+o+'.mp3']))
  ),
  baseUrl:'https://tonejs.github.io/audio/salamander/'
}).toDestination();
const preview = c => sampler.triggerAttackRelease(NOTES_LINEAR[c], PREVIEW_DUR, Tone.now());

/* ------------------------------------------------------------------
 * WEB-MIDI + CALIBRATION
 * ----------------------------------------------------------------*/
let midiAccess=null, midiInput=null;
let rangeLow = Number.NEGATIVE_INFINITY, rangeHigh = Number.POSITIVE_INFINITY;

/* replace the existing showModal definition with this one */
function showModal(html) {
  let ov = document.getElementById('calibOverlay');

  /* 1️⃣  Create the overlay only once */
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'calibOverlay';

    /* inline styles so we don’t rely on external CSS */
    Object.assign(ov.style, {
      position:      'fixed',
      inset:         0,                       // top:0 right:0 bottom:0 left:0
      background:    'rgba(0,0,0,.45)',
      display:       'flex',
      alignItems:    'center',
      justifyContent:'center',
      zIndex:        10000,
      fontFamily:    'system-ui'
    });

    /* inner box that holds the text */
    const box = document.createElement('div');
    box.id = 'calibBox';
    Object.assign(box.style, {
      background:'#fafafa',
      borderRadius:'12px',
      padding:'24px 32px',
      maxWidth:'290px',
      textAlign:'center',
      lineHeight:'1.4',
      boxShadow:'0 6px 24px rgba(0,0,0,.3)'
    });

    ov.appendChild(box);
    document.body.appendChild(ov);
  }

  /* 2️⃣  Put the new message inside and reveal the overlay */
  document.getElementById('calibBox').innerHTML = html;
  ov.style.display = 'flex';
}

/* hideModal stays the same */
const hideModal = () => {
  const o = document.getElementById('calibOverlay');
  if (o) o.style.display = 'none';
};

/* --------  Calibration flow  -------- */
let calibActive=false, calibStage=0, tmpLow=null;
function startCalibration(autoTriggered){
  calibActive=true; calibStage=0; tmpLow=null;
  showModal(`<h2>Keyboard Calibration</h2>
             <p>Please press the <strong>lowest note</strong> on your MIDI keyboard.</p>
             <p><small>We need your instrument’s true range so the on-screen piano matches what you can play.</small></p>`);
  if(!autoTriggered) midiBtn.focus();
}
function finishCalibration(low, high){
  rangeLow=low; rangeHigh=high; calibActive=false; hideModal();
  applyRangeTint();
  calibBtn.disabled=false;
}
function applyRangeTint(){
  document.querySelectorAll('.key').forEach(k=>{
    const m = noteNameToMidi(k.dataset.note);
    k.classList.toggle('available', m>=rangeLow && m<=rangeHigh);
  });
}

/* --------  Connect / disconnect  -------- */
async function connectMIDI(){
  try{
    midiAccess = await navigator.requestMIDIAccess();
  }catch(e){
    alert('Web-MIDI access was denied.'); return;
  }
  const inputs = [...midiAccess.inputs.values()];
  if(!inputs.length){ alert('No MIDI inputs detected. Plug in your keyboard and try again.'); return; }

  midiInput = inputs[0];
  midiInput.addEventListener('midimessage', handleMIDI);
  midiAccess.addEventListener('statechange', e=>{
    if(e.port.type==='input' && e.port.state==='disconnected') disconnectMIDI();
  });

  midiBtn.textContent='Disconnect';
  midiBtn.style.background='#e65a4f';
  calibBtn.disabled=false;

  /* auto-calibrate on first connection if we haven’t yet */
  if(rangeLow===Number.NEGATIVE_INFINITY) startCalibration(true);
}
function disconnectMIDI(){
  if(midiInput)   midiInput.removeEventListener('midimessage', handleMIDI);
  midiAccess=null; midiInput=null;
  midiBtn.textContent='Connect Piano';
  midiBtn.style.background='green';
  calibBtn.disabled=true;
  document.querySelectorAll('.key.available').forEach(k=>k.classList.remove('available'));
}

/* --------  MIDI message handler  -------- */
function handleMIDI(evt){
  const [status, noteNum, vel] = evt.data;
  const msgType = status & 0xF0;                     // mask channel
  const noteName = midiToNoteName(noteNum);
  const velocity = vel / 127;

  /* ----- Calibration logic ----- */
  if(calibActive && msgType===0x90 && vel){
    if(calibStage===0){
      tmpLow = noteNum;
      calibStage=1;
      showModal(`<h2>Great!</h2>
                 <p>Now press the <strong>highest note</strong> on your keyboard.</p>`);
    }else if(calibStage===1){
      finishCalibration(tmpLow, noteNum);
    }
  }

  /* ----- Normal playback logic ----- */
  const keyDiv = piano.querySelector(`.key[data-note="${noteName}"]`);
  if(msgType===0x90 && vel){                     // Note On
    sampler.triggerAttack(noteName, Tone.now(), velocity);
    ongoingHeld.add(noteName); manualHeld.add(noteName);
    if(keyDiv) keyDiv.classList.add('held');
  }
  else if(msgType===0x80 || (msgType===0x90 && vel===0)){ // Note Off
    if(ongoingHeld.delete(noteName)) sampler.triggerRelease(noteName, Tone.now());
    manualHeld.delete(noteName);
    if(keyDiv) keyDiv.classList.remove('held');
  }
}

/* --------  Button wiring  -------- */
midiBtn.onclick  = () => midiInput ? disconnectMIDI() : connectMIDI();
calibBtn.onclick = () => startCalibration(false);
window.addEventListener('beforeunload', disconnectMIDI);

/* ------------------------------------------------------------------
 * SCALE LABELS + SHADING
 * ----------------------------------------------------------------*/
function spelledScale(tonic, mode){
  const iv = mode==='minor'? MIN : MAJ;
  const root = pcOf(tonic), letters = ['C','D','E','F','G','A','B'];
  const idx=letters.indexOf(tonic[0]);
  const pcs=[], names=[];
  for(let i=0;i<7;i++){
    const L=letters[(idx+i)%7], nat=NAT_PC[L], tgt=(root+iv[i])%12;
    let d=(tgt-nat+12)%12; if(d>6)d-=12;
    let acc=''; if(d===1)acc='♯'; if(d===2)acc='♯♯'; if(d===-1)acc='♭'; if(d===-2)acc='♭♭';
    pcs.push(tgt); names.push(L+acc);
  }
  return {pcs,names};
}
function updateKeyLabels(){
  const {pcs,names}=spelledScale(tonicSel.value, modeSel.value);
  const pcSet=new Set(pcs), pcNameMap={}; names.forEach((n,i)=>pcNameMap[pcs[i]]=n);
  labelCells.forEach((c,i)=>c.textContent = pcNameMap[pcOf(NOTES_LINEAR[i].replace(/\d+/,''))] ?? '');
  keySpans  .forEach((s,i)=>s.textContent = pcNameMap[pcOf(NOTES_LINEAR[i].replace(/\d+/,''))] ?? '');
  for(let r=0;r<ROWS;r++){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++){
      pcSet.has(pcOf(NOTES_LINEAR[c].replace(/\d+/,''))) ? cells[c].classList.remove('outkey')
                                                         : cells[c].classList.add   ('outkey');
    }
  }
  saveAll();
}
tonicSel.addEventListener('change', updateKeyLabels);
modeSel .addEventListener('change', updateKeyLabels);

/* ------------------------------------------------------------------
 * TWO-DIGIT FINGERINGS
 * ----------------------------------------------------------------*/
function renderFings(td){
  const d=(td.dataset.fing||'').slice(-2);
  if(!d){ td.innerHTML=''; td.classList.remove('fingering'); return; }
  td.innerHTML = d.length===1
      ? `<div class="fing single">${d}</div>`
      : `<div class="fing top">${d[0]}</div><div class="fing bot">${d[1]}</div>`;
  td.classList.add('fingering');
}
const addFing   = (td,d)=>{ if((td.dataset.fing||'').includes(d))return;
  td.dataset.fing=((td.dataset.fing||'')+d).slice(-2); renderFings(td); };
const clearFing = td     =>{ delete td.dataset.fing; renderFings(td); };

/* ------------------------------------------------------------------
 * WORKSPACES  (state includes playMode, etc.)
 * ----------------------------------------------------------------*/
let workspaces=[], current=0;
function gatherState(){
  const green=[], blue=[], fings=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const td=grid.rows[r].cells[c], idx=r*COLS+c;
    if(td.classList.contains('on'))   green.push(idx);
    if(td.classList.contains('blue')) blue .push(idx);
    if(td.dataset.fing) fings.push([idx, td.dataset.fing]);
  }
  return {key:tonicSel.value, mode:modeSel.value, tempo:tempo.value,
          playMode:modeDrop.value, green, blue, fings};
}
function applyState(st){
  /* wipe */
  grid.querySelectorAll('td').forEach(td=>{
    td.classList.remove('on','blue','fingering','selected');
    td.innerHTML=''; delete td.dataset.fing;
  });
  if(!st){ updateKeyLabels(); return; }
  tonicSel.value=st.key || tonicSel.value;
  modeSel .value=st.mode|| modeSel.value;
  tempo   .value=st.tempo||tempo.value;
  modeDrop.value=st.playMode||'playback';
  st.green?.forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('on'));
  st.blue ?.forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('blue'));
  st.fings?.forEach(([i,d])=>{ const td=grid.rows[i/COLS|0].cells[i%COLS]; td.dataset.fing=d; renderFings(td); });
  updateKeyLabels();
}
function saveAll(){ workspaces[current].state=gatherState(); localStorage.setItem(STORE_KEY, JSON.stringify(workspaces)); }

function buildTabs(){
  tabsBox.innerHTML='';
  workspaces.forEach((ws,i)=>{
    const t=document.createElement('div'); t.className='tab'; t.textContent=ws.name;
    t.onclick=()=>{ if(i===current){
      const n=prompt('Rename workspace:', ws.name);
      if(n&&n.trim()){ ws.name=n.trim(); t.textContent=n; saveAll(); }
    } else activateTab(i); };
    tabsBox.appendChild(t);
  });
  [...tabsBox.children].forEach((el,i)=>el.classList.toggle('active', i===current));
}
function activateTab(i){
  stop(); saveAll(); current=i; buildTabs(); applyState(workspaces[i].state);
}
(function initWorkspaces(){
  try{workspaces=JSON.parse(localStorage.getItem(STORE_KEY)||'null')||[];}catch{}
  if(!workspaces.length) workspaces=[{name:'Workspace 1', state:null}];
  buildTabs(); applyState(workspaces[0].state);
})();
addBtn.onclick=()=>{ if(workspaces.length>=MAX_WS) return;
  workspaces.push({name:`Workspace ${workspaces.length+1}`, state:null});
  buildTabs(); activateTab(workspaces.length-1);
};

/* ------------------------------------------------------------------
 * GRID INTERACTION (pointer events, selection, fingerings)
 * ----------------------------------------------------------------*/
const sel=new Set(); let tmpSel=new Set();
let down=false, drag=false, sRow=0, sCol=0, hover=null;
const isNote=td=>td.classList.contains('on') || td.classList.contains('blue');

/* no context menu on grid */
grid.addEventListener('contextmenu', e=>e.preventDefault());

/* hover / drag-selection */
grid.addEventListener('pointerover', e=>{
  hover=e.target.closest('td')||null;
  if(!down || !hover) return;
  const r=hover.parentNode.rowIndex, c=hover.cellIndex;
  if(!drag && (r!==sRow || c!==sCol)){ drag=true; lasso.style.display='block'; }
  if(drag){
    const [minR,maxR]=[Math.min(sRow,r), Math.max(sRow,r)],
          [minC,maxC]=[Math.min(sCol,c), Math.max(sCol,c)];
    Object.assign(lasso.style,{
      display:'block', left:minC*CELL_PX+'px', top:minR*CELL_PX+'px',
      width:(maxC-minC+1)*CELL_PX+'px', height:(maxR-minR+1)*CELL_PX+'px'
    });
    tmpSel.forEach(td=>td.classList.remove('selected')); tmpSel.clear();
    for(let R=minR;R<=maxR;R++){
      const cells=grid.rows[R].cells;
      for(let C=minC;C<=maxC;C++){
        const td=cells[C]; if(isNote(td)){ td.classList.add('selected'); tmpSel.add(td); }
      }
    }
  }
});
/* pointer down */
grid.addEventListener('pointerdown', e=>{
  const td=e.target.closest('td'); if(!td) return;
  down=true; drag=false; sRow=td.parentNode.rowIndex; sCol=td.cellIndex;
  if(sel.size) return;
});
/* pointer up */
window.addEventListener('pointerup', e=>{
  if(!down) return; down=false;
  if(drag){
    drag=false; lasso.style.display='none';
    sel.clear(); tmpSel.forEach(td=>sel.add(td)); tmpSel.forEach(td=>preview(td.cellIndex)); tmpSel.clear();
    saveAll(); return;
  }
  const td=hover; if(!td) return;
  if(sel.size){ sel.clear(); return; }

  if(e.button===2){ td.classList.toggle('blue'); td.classList.remove('on'); }
  else{             td.classList.toggle('on');  td.classList.remove('blue'); }
  if(isNote(td)) preview(td.cellIndex);
  clearFing(td); saveAll();
});
/* click outside grid clears selection */
document.addEventListener('pointerdown', e=>{
  if(!grid.contains(e.target)){
    sel.clear(); grid.querySelectorAll('.selected').forEach(t=>t.classList.remove('selected'));
  }
});

/* keyboard shortcuts for moving selection + fingerings */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    sel.clear(); grid.querySelectorAll('.selected').forEach(t=>t.classList.remove('selected')); return;
  }
  if(sel.size && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    let dR=0,dC=0; if(e.key==='ArrowUp')dR=-1; if(e.key==='ArrowDown')dR=1;
    if(e.key==='ArrowLeft')dC=-1; if(e.key==='ArrowRight')dC=1;
    e.preventDefault();
    for(const td of sel){
      const r=td.parentNode.rowIndex+dR,c=td.cellIndex+dC;
      if(r<0||r>=ROWS||c<0||c>=COLS) return;
    }
    const moves=[]; sel.forEach(src=>{
      const r=src.parentNode.rowIndex, c=src.cellIndex;
      moves.push([src, grid.rows[r+dR].cells[c+dC]]);
    });
    moves.forEach(([s])=>{
      s.classList.remove('on','blue','fingering','selected');
      delete s.dataset.fing; s.innerHTML='';
    });
    moves.forEach(([src,dst])=>{
      dst.classList.add(src.classList.contains('blue')?'blue':'on','selected');
      if(src.dataset.fing){ dst.dataset.fing=src.dataset.fing; renderFings(dst); }
    });
    sel.clear(); moves.forEach(([,d])=>sel.add(d)); saveAll(); return;
  }
  /* fingering digits */
  if(!hover || !isNote(hover)) return;
  if(['1','2','3','4','5'].includes(e.key)){ addFing(hover,e.key); saveAll(); }
  else{ clearFing(hover); saveAll(); }
});

/* ------------------------------------------------------------------
 * MANUAL PIANO (mouse/touch)
 * ----------------------------------------------------------------*/
piano.addEventListener('pointerdown', e=>{
  const k=e.target.closest('.key'); if(!k) return;
  k.classList.add('held'); manualHeld.add(k.dataset.note);
  sampler.triggerAttack(k.dataset.note,Tone.now());
});
window.addEventListener('pointerup', ()=>{
  document.querySelectorAll('.key.held').forEach(k=>{
    k.classList.remove('held');
    manualHeld.delete(k.dataset.note);
    sampler.triggerRelease(k.dataset.note,Tone.now());
  });
});

/* ------------------------------------------------------------------
 * PLAYBACK ENGINE
 * ----------------------------------------------------------------*/
let timer=null, rowPtr=0, lastRow=0, heldDuringPlay=new Set(), beatEnd=0;
const msPerRow = () => 60000 / (+tempo.value || 120);

// ----- wrap the grid in a positioned container -----
const wrap = document.createElement('div');
wrap.id = 'gridWrap';
Object.assign(wrap.style, {
  position: 'relative',     // 👈 makes this the positioning context
  display:  'inline-block',
  overflow: 'hidden'
});
grid.parentNode.insertBefore(wrap, grid); // move wrap in
wrap.appendChild(grid);                   // and drop the grid inside

// ----- playback cursor that now starts at the top of the grid -----
const cursor = document.createElement('div');
cursor.id = 'cursor';
Object.assign(cursor.style, {
  position:   'absolute',
  top:        0,
  left:       0,
  width:      '100%',
  height:     '2px',
  background: 'red',
  pointerEvents: 'none',
  transform:  'translateY(-2px)',
  transition: 'transform 0ms linear',
  zIndex:     9999
});
wrap.appendChild(cursor);                // cursor lives inside wrap
const lasso=document.createElement('div'); lasso.id='lasso'; wrap.appendChild(lasso);

function resetVisuals(){
  cursor.style.transition='transform 0ms linear'; cursor.style.transform='translateY(-2px)';
  grid  .style.transition='transform 0ms linear'; grid  .style.transform='translateY(0)';
}

function findLastRow(){
  for(let r=ROWS-1;r>=0;r--){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++) if(isNote(cells[c])) return r;
  } return -1;
}

function setWaiting(waiting){
  playB.style.background = waiting ? 'orange' : (timer ? 'green' : '');
}

/* ----- playback-mode step ----- */
function stepPlayback(){
  cursor.style.transitionDuration='0ms';
  cursor.style.transform=`translateY(${rowPtr*ROW_PX}px)`;
  /* release notes no longer active */
  heldDuringPlay.forEach(n=>{
    const col=NOTES_LINEAR.indexOf(n);
    if(!grid.rows[rowPtr] || !isNote(grid.rows[rowPtr].cells[col])){
      sampler.triggerRelease(n, Tone.now()); heldDuringPlay.delete(n);
    }
  });
  /* trigger new notes */
  const cells=grid.rows[rowPtr].cells;
  for(let c=0;c<COLS;c++){
    if(isNote(cells[c]) && !heldDuringPlay.has(NOTES_LINEAR[c])){
      sampler.triggerAttack(NOTES_LINEAR[c], Tone.now());
      heldDuringPlay.add(NOTES_LINEAR[c]);
    }
  }
  if(++rowPtr > lastRow){ pause(); return; }
  cursor.style.transitionDuration=msPerRow()+'ms';
  cursor.style.transform=`translateY(${rowPtr*ROW_PX}px)`;
}

/* helpers for WAIT mode */
const notesForRow=r=>{
  const arr=[]; if(r>=ROWS) return arr;
  const cells=grid.rows[r].cells;
  for(let c=0;c<COLS;c++) if(isNote(cells[c])) arr.push(NOTES_LINEAR[c]);
  return arr;
};

/* ----- wait-mode step ----- */
function stepWait(){
  const now=Date.now(); if(now < beatEnd) return;
  const need=notesForRow(rowPtr);
  const satisfied = need.every(n=>manualHeld.has(n));
  if(satisfied){
    setWaiting(false);
    need.forEach(n=>{ if(!heldDuringPlay.has(n)){ sampler.triggerAttack(n, Tone.now()); heldDuringPlay.add(n); }});
    const dur=msPerRow(); beatEnd = now + dur;
    grid.style.transition=`transform ${dur}ms linear`;
    grid.style.transform=`translateY(${- (rowPtr+1)*ROW_PX}px)`;
    if(++rowPtr > lastRow){
      clearInterval(timer); timer=null;
      setTimeout(()=>{ stop(); play(); }, dur);       // loop automatically
    }
  }else setWaiting(true);
}

/* helpers */
function stopAllNotes(){ heldDuringPlay.forEach(n=>sampler.triggerRelease(n, Tone.now())); heldDuringPlay.clear(); }

/* core controls */
function play(){
  if(timer) return;
  rowPtr=0; resetVisuals(); lastRow=findLastRow();
  if(lastRow<0){ alert('Nothing to play in this workspace!'); return; }
  if(modeDrop.value==='playback'){
    setWaiting(false); beatEnd=Date.now()+msPerRow();
    stepPlayback(); timer=setInterval(stepPlayback, msPerRow());
  }else{
    setWaiting(true); beatEnd=Date.now();  // eligible immediately
    stepWait(); timer=setInterval(stepWait, 50);      // poll often
  }
}
function pause(){ if(!timer) return; clearInterval(timer); timer=null; stopAllNotes(); setWaiting(false); }
function stop (){ pause(); resetVisuals(); rowPtr=0; }

/* ------------------------------------------------------------------
 * TRANSPORT BUTTONS
 * ----------------------------------------------------------------*/
playB .addEventListener('click', play );
pauseB.addEventListener('click', pause);
stopB .addEventListener('click', stop );
