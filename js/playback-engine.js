/* ================================================================
 *  Playback engine (play / pause / stop, cursor scrolling)
 * ===============================================================*/
const playB=$('playBtn'), pauseB=$('pauseBtn'), stopB=$('stopBtn');

let timer=null, rowPtr=0, lastRow=0, held=new Set(), beatEnd=0;
const msPerRow = ()=> 60000 / (+$('tempo').value || 120);

function findLastRow(){
  for(let r=ROWS-1;r>=0;r--){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++) if(cells[c].classList.contains('on') || cells[c].classList.contains('blue')) return r;
  }
  return -1;
}
function resetVisuals(){
  cursor.style.transition='transform 0ms linear'; cursor.style.transform='translateY(-2px)';
  grid  .style.transition='transform 0ms linear'; grid  .style.transform='translateY(0)';
}
function setWaiting(flag){
  playB.style.background = flag ? 'orange' : (timer?'green':'');
}

/* playback-mode step --------------------------------------------- */
function stepPlayback(){
  cursor.style.transitionDuration='0ms';
  cursor.style.transform=`translateY(${rowPtr*ROW_PX}px)`;

  /* release stale notes */
  held.forEach(n=>{
    const col=NOTES_LINEAR.indexOf(n);
    if(!grid.rows[rowPtr] || !grid.rows[rowPtr].cells[col].classList.contains('on')){
      sampler.triggerRelease(n,Tone.now()); held.delete(n);
    }
  });

  /* trigger current row */
  const cells=grid.rows[rowPtr].cells;
  for(let c=0;c<COLS;c++){
    if(cells[c].classList.contains('on') && !held.has(NOTES_LINEAR[c])){
      sampler.triggerAttack(NOTES_LINEAR[c],Tone.now()); held.add(NOTES_LINEAR[c]);
    }
  }

  if(++rowPtr>lastRow){ pause(); return; }
  cursor.style.transitionDuration=msPerRow()+'ms';
  cursor.style.transform=`translateY(${rowPtr*ROW_PX}px)`;
}

/* wait-mode helpers ---------------------------------------------- */
const notesForRow=r=>{
  const arr=[]; if(r>=ROWS)return arr;
  const cells=grid.rows[r].cells;
  for(let c=0;c<COLS;c++) if(cells[c].classList.contains('on')) arr.push(NOTES_LINEAR[c]);
  return arr;
};
function stepWait(){
  const now=Date.now(); if(now<beatEnd) return;
  const need=notesForRow(rowPtr), satisfied=need.every(n=>manualHeld.has(n));
  if(satisfied){
    setWaiting(false);
    need.forEach(n=>{
      if(!held.has(n)){ sampler.triggerAttack(n,Tone.now()); held.add(n); }
    });
    const dur=msPerRow(); beatEnd=now+dur;
    grid.style.transition=`transform ${dur}ms linear`;
    grid.style.transform=`translateY(${- (rowPtr+1)*ROW_PX}px)`;
    if(++rowPtr>lastRow){
      clearInterval(timer); timer=null;
      setTimeout(()=>{ stop(); play(); }, dur);   // loop
    }
  }else setWaiting(true);
}

/* public controls ------------------------------------------------- */
function play(){
  if(timer) return;
  rowPtr=0; resetVisuals(); lastRow=findLastRow();
  if(lastRow<0){ alert('Nothing to play!'); return; }

  if($('playMode').value==='playback'){
    setWaiting(false); beatEnd=Date.now()+msPerRow();
    stepPlayback(); timer=setInterval(stepPlayback,msPerRow());
  }else{
    setWaiting(true); beatEnd=Date.now();
    stepWait(); timer=setInterval(stepWait,50);
  }
}
function pause(){
  if(!timer) return;
  clearInterval(timer); timer=null;
  held.forEach(n=>sampler.triggerRelease(n,Tone.now())); held.clear();
  setWaiting(false);
}
function stop(){
  pause(); resetVisuals(); rowPtr=0;
}

/* transport buttons ---------------------------------------------- */
playB .onclick = play;
pauseB.onclick = pause;
stopB .onclick = stop;

/* expose play/stop for workspaces -------------------------------- */
window.stop = stop;
