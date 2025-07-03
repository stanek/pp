/* ------------------------------------------------------------------
 * CONFIGURATION
 * ----------------------------------------------------------------*/
const MAX_WS = 10;
const OCTAVES      = [2,3,4,5];
const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLE_ROOTS = ['A','C','D#','F#'];
const ROWS = 200;
const COLS = OCTAVES.length * NOTE_NAMES.length;
const CELL_PX = 26;              // grid square
const ROW_PX  = CELL_PX + 1;     // +1px collapsed border
const PREVIEW_DUR = 0.25;
const STORE_KEY   = 'pianoSequencerWorkspaces';

/* ------------------------------------------------------------------
 * DOM SHORTCUTS
 * ----------------------------------------------------------------*/
const $=id=>document.getElementById(id);
const piano=$('piano'), grid=$('grid');
const playB=$('playBtn'), pauseB=$('pauseBtn'), stopB=$('stopBtn');
const tempo=$('tempo'), tonicSel=$('tonicSelect'), modeSel=$('modeSelect');
const addBtn=$('addWS'), tabsBox=$('tabs'), modeDrop=$('playMode');

/* ------------------------------------------------------------------
 * WRAP GRID  (cursor + lasso)
 * ----------------------------------------------------------------*/
const wrap=document.createElement('div');
wrap.id='gridWrap';
wrap.style.position='relative';
wrap.style.display='inline-block';
wrap.style.overflow='hidden';
grid.parentNode.insertBefore(wrap, grid);
wrap.appendChild(grid);

const cursor=Object.assign(document.createElement('div'),{
  id:'cursor',
  style:'position:absolute;top:0;left:0;width:100%;height:2px;'+
        'background:red;pointer-events:none;transform:translateY(-2px);'+
        'transition:transform 0ms linear;z-index:9999' });
const lasso =Object.assign(document.createElement('div'),{id:'lasso'});
wrap.append(cursor, lasso);

/* ------------------------------------------------------------------
 * NOTE HELPERS
 * ----------------------------------------------------------------*/
const pcOf=n=>({C:0,'B#':0,'C#':1,'Db':1,D:2,'D#':3,'Eb':3,E:4,'Fb':4,'E#':5,
F:5,'F#':6,'Gb':6,G:7,'G#':8,'Ab':8,A:9,'A#':10,'Bb':10,B:11,'Cb':11}[n]);
const NOTES_LINEAR = OCTAVES.flatMap(o=>NOTE_NAMES.map(n=>n+o));
const COL_PC       = NOTES_LINEAR.map(n=>pcOf(n.replace(/\d+/,'')));
const NAT_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJ=[0,2,4,5,7,9,11], MIN=[0,2,3,5,7,8,10];

/* ------------------------------------------------------------------
 * STATIC PIANO + GRID
 * ----------------------------------------------------------------*/
const labelCells=[], keySpans=[];
(function buildUI(){
  const rOct=piano.insertRow(), rLab=piano.insertRow(), rKey=piano.insertRow();
  OCTAVES.forEach(o=>{
    const oc=rOct.insertCell(); oc.colSpan=NOTE_NAMES.length; oc.textContent=o; oc.className='octave';
    NOTE_NAMES.forEach(n=>{
      const lab=rLab.insertCell(); lab.className='note'; labelCells.push(lab);
      const kc=rKey.insertCell();
      const div=document.createElement('div');
      div.className=`key ${n.includes('#')?'black':'white'}`; div.dataset.note=n+o;
      const span=document.createElement('span'); span.className='botlabel'; div.appendChild(span); keySpans.push(span);
      kc.appendChild(div);
    });
  });
  for(let r=0;r<ROWS;r++){ const row=grid.insertRow(); for(let c=0;c<COLS;c++) row.insertCell(); }
})();

/* ------------------------------------------------------------------
 * AUDIO
 * ----------------------------------------------------------------*/
const sampler=new Tone.Sampler({
  urls:Object.fromEntries(
    OCTAVES.flatMap(o=>SAMPLE_ROOTS.map(n=>[`${n}${o}`,n.replace('#','s')+o+'.mp3']))
  ),
  baseUrl:'https://tonejs.github.io/audio/salamander/'
}).toDestination();
const preview=col=>sampler.triggerAttackRelease(NOTES_LINEAR[col], PREVIEW_DUR, Tone.now());

/* ------------------------------------------------------------------
 * SCALE LABELS + SHADING
 * ----------------------------------------------------------------*/
function spelledScale(t,m){
  const iv=m==='minor'?MIN:MAJ,root=pcOf(t),letters=['C','D','E','F','G','A','B'],idx=letters.indexOf(t[0]);
  const pcs=[],names=[];
  for(let i=0;i<7;i++){
    const L=letters[(idx+i)%7],nat=NAT_PC[L],tgt=(root+iv[i])%12;
    let d=(tgt-nat+12)%12; if(d>6)d-=12;
    let acc=''; if(d===1)acc='♯'; if(d===2)acc='♯♯'; if(d===-1)acc='♭'; if(d===-2)acc='♭♭';
    pcs.push(tgt); names.push(L+acc);
  }
  return {pcs,names};
}
function updateKeyLabels(){
  const {pcs,names}=spelledScale(tonicSel.value,modeSel.value);
  const set=new Set(pcs),map={}; names.forEach((n,i)=>map[pcs[i]]=n);
  labelCells.forEach((c,i)=>c.textContent=map[COL_PC[i]]??'');
  keySpans  .forEach((s,i)=>s.textContent=map[COL_PC[i]]??'');
  for(let r=0;r<ROWS;r++){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++) set.has(COL_PC[c])?cells[c].classList.remove('outkey')
                                             :cells[c].classList.add   ('outkey');
  }
  saveAll();
}
tonicSel.addEventListener('change',updateKeyLabels);
modeSel .addEventListener('change',updateKeyLabels);

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
  td.dataset.fing=((td.dataset.fing||'')+d).slice(-2); renderFings(td);};
const clearFing = td     =>{ delete td.dataset.fing; renderFings(td); };

/* ------------------------------------------------------------------
 * WORKSPACES (state now includes playMode)
 * ----------------------------------------------------------------*/
let workspaces=[], current=0;
function gatherState(){
  const green=[],blue=[],fings=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const td=grid.rows[r].cells[c], idx=r*COLS+c;
    if(td.classList.contains('on'))   green.push(idx);
    if(td.classList.contains('blue')) blue .push(idx);
    if(td.dataset.fing) fings.push([idx,td.dataset.fing]);
  }
  return {key:tonicSel.value,mode:modeSel.value,tempo:tempo.value,playMode:modeDrop.value,green,blue,fings};
}
function applyState(s){
  grid.querySelectorAll('td').forEach(td=>{
    td.classList.remove('on','blue','fingering','selected');
    td.innerHTML=''; delete td.dataset.fing;
  });
  if(!s){ updateKeyLabels(); return; }
  tonicSel.value=s.key || tonicSel.value;
  modeSel.value =s.mode|| modeSel.value;
  tempo .value  =s.tempo||tempo.value;
  modeDrop.value=s.playMode||'playback';
  s.green?.forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('on'));
  s.blue ?.forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('blue'));
  s.fings?.forEach(([i,d])=>{ const td=grid.rows[i/COLS|0].cells[i%COLS]; td.dataset.fing=d; renderFings(td); });
  updateKeyLabels();
}
function saveAll(){ workspaces[current].state=gatherState(); localStorage.setItem(STORE_KEY,JSON.stringify(workspaces)); }

function buildTabs(){
  tabsBox.innerHTML='';
  workspaces.forEach((ws,i)=>{
    const t=document.createElement('div'); t.className='tab'; t.textContent=ws.name;
    t.onclick=()=>{ if(i===current){ const n=prompt('Rename workspace:',ws.name);
      if(n&&n.trim()){ ws.name=n.trim(); t.textContent=n; saveAll(); } } else activateTab(i); };
    tabsBox.appendChild(t);
  });
  [...tabsBox.children].forEach((el,i)=>el.classList.toggle('active',i===current));
}
function activateTab(i){
  stop();                               // ← stop any running playback
  saveAll(); current=i; buildTabs(); applyState(workspaces[i].state);
}
(function initWS(){
  try{ workspaces=JSON.parse(localStorage.getItem(STORE_KEY)||'null')||[]; }catch{}
  if(!workspaces.length) workspaces=[{name:'Workspace 1',state:null}];
  buildTabs(); applyState(workspaces[0].state);
})();
addBtn.onclick=()=>{ if(workspaces.length<MAX_WS){
  workspaces.push({name:`Workspace ${workspaces.length+1}`,state:null});
  buildTabs(); activateTab(workspaces.length-1);}};

/* ------------------------------------------------------------------
 * GRID INTERACTION (green/blue + fingerings) – unchanged
 * ----------------------------------------------------------------*/
const sel=new Set();let tmp=new Set();
let down=false,drag=false,sRow=0,sCol=0, hover=null;
const isNote=td=>td.classList.contains('on')||td.classList.contains('blue');
grid.addEventListener('contextmenu',e=>e.preventDefault());

grid.addEventListener('pointerover',e=>{
  hover=e.target.closest('td')||null;
  if(!down||!hover) return;
  const r=hover.parentNode.rowIndex,c=hover.cellIndex;
  if(!drag&&(r!==sRow||c!==sCol)){ drag=true; lasso.style.display='block'; }
  if(drag){
    const [minR,maxR]=[Math.min(sRow,r),Math.max(sRow,r)],
          [minC,maxC]=[Math.min(sCol,c),Math.max(sCol,c)];
    Object.assign(lasso.style,{display:'block',left:minC*CELL_PX+'px',top:minR*CELL_PX+'px',
      width:(maxC-minC+1)*CELL_PX+'px',height:(maxR-minR+1)*CELL_PX+'px'});
    tmp.forEach(td=>td.classList.remove('selected')); tmp.clear();
    for(let R=minR;R<=maxR;R++){ const cells=grid.rows[R].cells;
      for(let C=minC;C<=maxC;C++){ const td=cells[C];
        if(isNote(td)){td.classList.add('selected'); tmp.add(td);} } }
  }
});
grid.addEventListener('pointerdown',e=>{
  const td=e.target.closest('td'); if(!td) return;
  down=true; drag=false; sRow=td.parentNode.rowIndex; sCol=td.cellIndex; if(sel.size) return;
});
window.addEventListener('pointerup',e=>{
  if(!down) return; down=false;
  if(drag){
    drag=false; lasso.style.display='none';
    sel.clear(); tmp.forEach(td=>sel.add(td)); tmp.forEach(td=>preview(td.cellIndex)); tmp.clear(); saveAll(); return;
  }
  const td=hover; if(!td) return;
  if(sel.size){ sel.clear(); return; }

  if(e.button===2){ td.classList.toggle('blue'); td.classList.remove('on'); }
  else{             td.classList.toggle('on');  td.classList.remove('blue'); }
  if(isNote(td)) preview(td.cellIndex);
  clearFing(td); saveAll();
});
document.addEventListener('pointerdown',e=>{ if(!grid.contains(e.target)){
  sel.clear(); grid.querySelectorAll('.selected').forEach(t=>t.classList.remove('selected')); } });

/* Arrow moves & fingering edits (unchanged logic) */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ sel.clear(); grid.querySelectorAll('.selected').forEach(t=>t.classList.remove('selected')); return; }

  if(sel.size && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    let dR=0,dC=0; if(e.key==='ArrowUp')dR=-1; if(e.key==='ArrowDown')dR=1; if(e.key==='ArrowLeft')dC=-1; if(e.key==='ArrowRight')dC=1;
    e.preventDefault();
    for(const td of sel){ const r=td.parentNode.rowIndex+dR,c=td.cellIndex+dC;
      if(r<0||r>=ROWS||c<0||c>=COLS) return; }
    const moves=[]; sel.forEach(src=>{ const r=src.parentNode.rowIndex,c=src.cellIndex; moves.push([src,grid.rows[r+dR].cells[c+dC]]); });
    moves.forEach(([s])=>{ s.classList.remove('on','blue','fingering','selected'); delete s.dataset.fing; s.innerHTML=''; });
    moves.forEach(([src,dst])=>{
      dst.classList.add(src.classList.contains('blue')?'blue':'on','selected');
      if(src.dataset.fing){ dst.dataset.fing=src.dataset.fing; renderFings(dst); }
    });
    sel.clear(); moves.forEach(([,d])=>sel.add(d)); saveAll(); return;
  }

  if(!hover || !isNote(hover)) return;
  if(['1','2','3','4','5'].includes(e.key)){ addFing(hover,e.key); saveAll(); }
  else{ clearFing(hover); saveAll(); }
});

/* ------------------------------------------------------------------
 * MANUAL PIANO TRACKING (for Wait Mode)
 * ----------------------------------------------------------------*/
const manualHeld=new Set();
piano.addEventListener('pointerdown',e=>{
  const k=e.target.closest('.key'); if(!k) return;
  k.classList.add('held'); manualHeld.add(k.dataset.note);
  sampler.triggerAttack(k.dataset.note,Tone.now());
});
window.addEventListener('pointerup',()=>{
  document.querySelectorAll('.key.held').forEach(k=>{
    k.classList.remove('held'); manualHeld.delete(k.dataset.note);
    sampler.triggerRelease(k.dataset.note,Tone.now());
  });
});

/* ------------------------------------------------------------------
 * PLAY BUTTON COLOUR
 * ----------------------------------------------------------------*/
function setWaiting(wait){
  playB.style.background = wait ? 'orange'
                        : (timer ? 'green' : '');
}

/* ------------------------------------------------------------------
 * PLAYBACK ENGINE
 * ----------------------------------------------------------------*/
let timer=null,rowPtr=0,lastRow=0,held=new Set(),beatEnd=0;
const msPerRow = () => 60000 / (+tempo.value || 120);

function findLastRow(){
  for(let r=ROWS-1;r>=0;r--){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++) if(isNote(cells[c])) return r;
  }
  return -1;
}
function resetVisuals(){
  cursor.style.transition='transform 0ms linear'; cursor.style.transform='translateY(-2px)';
  grid  .style.transition='transform 0ms linear'; grid  .style.transform='translateY(0px)';
}

/* ---------- Playback Mode step ---------- */
function stepPlayback(){
  cursor.style.transitionDuration='0ms';
  cursor.style.transform=`translateY(${rowPtr * ROW_PX}px)`;

  held.forEach(n=>{
    const col=NOTES_LINEAR.indexOf(n);
    if(!grid.rows[rowPtr] || !isNote(grid.rows[rowPtr].cells[col])){
      sampler.triggerRelease(n,Tone.now()); held.delete(n);
    }
  });
  const cells=grid.rows[rowPtr].cells;
  for(let c=0;c<COLS;c++){
    if(isNote(cells[c]) && !held.has(NOTES_LINEAR[c])){
      sampler.triggerAttack(NOTES_LINEAR[c],Tone.now()); held.add(NOTES_LINEAR[c]);
    }
  }

  if(rowPtr++ >= lastRow){
    pause();                               // stop — no loop in playback mode
    return;
  }
  cursor.style.transitionDuration=msPerRow()+'ms';
  cursor.style.transform=`translateY(${rowPtr * ROW_PX}px)`;
}

/* ---------- Wait Mode helpers ---------- */
function notesForRow(r){
  const need=[]; if(r>=ROWS) return need;
  const cells=grid.rows[r].cells;
  for(let c=0;c<COLS;c++) if(isNote(cells[c])) need.push(NOTES_LINEAR[c]);
  return need;
}

/* ---------- Wait Mode step ------------- */
function stepWait(){
  const now=Date.now();
  if(now < beatEnd) return;                 // still scrolling this beat

  const need=notesForRow(rowPtr);           // could be empty (silent row)
  const satisfied = need.every(n=>manualHeld.has(n));

  if(satisfied){
    /* colour */
    setWaiting(false);

    /* play any new attacks */
    need.forEach(n=>{ if(!held.has(n)){ sampler.triggerAttack(n,Tone.now()); held.add(n);} });

    /* prepare next beat */
    const dur=msPerRow();
    beatEnd = now + dur;

    /* scroll grid */
    grid.style.transition=`transform ${dur}ms linear`;
    grid.style.transform = `translateY(${- (rowPtr+1)*ROW_PX}px)`;
    rowPtr++;

    if(rowPtr > lastRow){
      /* let final beat ring, then restart loop */
      clearInterval(timer); timer=null;
      setTimeout(loopRestart, dur);
    }
  }else{
    setWaiting(true);                       // waiting = orange
  }
}

/* ---------- loop restart helper -------- */
function loopRestart(){
  stopNotes(); resetVisuals(); play();      // restart only in WAIT mode
}
function stopNotes(){ held.forEach(n=>sampler.triggerRelease(n,Tone.now())); held.clear(); }

/* ---------- Play / Pause / Stop -------- */
function play(){
  if(timer) return;
  rowPtr=0; resetVisuals(); lastRow=findLastRow();
  if(lastRow<0){ alert('No notes to play in this workspace!'); return; }

  if(modeDrop.value==='playback'){
    setWaiting(false);
    beatEnd = Date.now() + msPerRow();
    stepPlayback();
    timer=setInterval(stepPlayback, msPerRow());
  }else{
    setWaiting(true);
    beatEnd=Date.now();                     // start immediately eligible
    stepWait();
    timer=setInterval(stepWait, 50);        // quick poll
  }
}
function pause(){ if(!timer) return; clearInterval(timer); timer=null; stopNotes(); setWaiting(false);}
function stop (){ pause(); resetVisuals(); rowPtr=0; }

/* ------------------------------------------------------------------
 * TRANSPORT BUTTONS
 * ----------------------------------------------------------------*/
playB .addEventListener('click',play);
pauseB.addEventListener('click',pause);
stopB .addEventListener('click',stop);
