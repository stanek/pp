/* ================================================================
 *  Build static piano, grid, wrapper, cursor & common DOM refs
 * ===============================================================*/
const $ = id => document.getElementById(id);

const piano   = $('piano');
const grid    = $('grid');
const transport = $('transport');

/* transport-bar MIDI buttons ------------------------------------ */
const midiBtn  = $('midiBtn') || Object.assign(document.createElement('button'),
                 { id:'midiBtn', textContent:'Connect Piano', style:'background:green' });
const calibBtn = $('calibBtn')|| Object.assign(document.createElement('button'),
                 { id:'calibBtn', textContent:'Calibrate', disabled:true });
if(!midiBtn.parentNode)  transport.prepend(midiBtn);
if(!calibBtn.parentNode) transport.insertBefore(calibBtn, midiBtn.nextSibling);

/* build piano & grid -------------------------------------------- */
const labelCells = [], keySpans = [], keyTds = [];

(function buildUI(){
  const rOct = piano.insertRow(),
        rLab = piano.insertRow(),
        rKey = piano.insertRow();

  OCTAVES.forEach(o=>{
    const oc=rOct.insertCell();
    oc.colSpan=NOTE_NAMES.length; oc.textContent=o; oc.className='octave';

    NOTE_NAMES.forEach(n=>{
      /* note name row */
      const lab=rLab.insertCell(); lab.className='note'; labelCells.push(lab);

      /* key row */
      const td=rKey.insertCell(); keyTds.push(td);
      const div=document.createElement('div');
      div.className=`key ${n.includes('#')?'black':'white'}`; div.dataset.note=n+o;
      const span=document.createElement('span'); span.className='botlabel'; div.appendChild(span);
      td.appendChild(div); keySpans.push(span);
    });
  });

  /* 200 × COLS sequencer grid */
  for(let r=0;r<ROWS;r++){
    const row=grid.insertRow();
    for(let c=0;c<COLS;c++) row.insertCell();
  }
})();

/* grid wrapper + cursor ----------------------------------------- */
const wrap = document.createElement('div');
wrap.id='gridWrap';
Object.assign(wrap.style,{position:'relative',display:'inline-block',overflow:'hidden'});
grid.parentNode.insertBefore(wrap, grid); wrap.appendChild(grid);

const cursor = document.createElement('div');
cursor.id='cursor';
Object.assign(cursor.style,{
  position:'absolute',top:0,left:0,width:'100%',height:'2px',background:'red',
  pointerEvents:'none',transform:'translateY(-2px)',transition:'transform 0ms linear',
  zIndex:9999
});
wrap.appendChild(cursor);

/* shared lasso */
const lasso=document.createElement('div'); lasso.id='lasso'; wrap.appendChild(lasso);

/* preview helper ------------------------------------------------- */
const preview = col => sampler.triggerAttackRelease(NOTES_LINEAR[col], PREVIEW_DUR, Tone.now());

/* key-signature labelling --------------------------------------- */
function spelledScale(tonic,mode){
  const iv = mode==='minor'? MIN : MAJ,
        root=pcOf(tonic), letters=['C','D','E','F','G','A','B'],
        idx=letters.indexOf(tonic[0]),
        pcs=[], names=[];
  for(let i=0;i<7;i++){
    const L=letters[(idx+i)%7], nat=NAT_PC[L], tgt=(root+iv[i])%12;
    let d=(tgt-nat+12)%12; if(d>6)d-=12;
    let acc=['','♯','♯♯','♭','♭♭'][{1:1,2:2,11:-1,10:-2}[d]??0];
    pcs.push(tgt); names.push(L+acc);
  }
  return {pcs,names};
}

function updateKeyLabels(){
  const tonic = $('tonicSelect').value,
        mode  = $('modeSelect').value,
        {pcs,names}=spelledScale(tonic,mode),
        set=new Set(pcs), map={};
  names.forEach((n,i)=>map[pcs[i]]=n);

  labelCells.forEach((td,i)=>td.textContent = map[pcOf(NOTES_LINEAR[i].replace(/\d+/,''))] ?? '');
  keySpans  .forEach((sp,i)=>sp.textContent = map[pcOf(NOTES_LINEAR[i].replace(/\d+/,''))] ?? '');

  for(let r=0;r<ROWS;r++){
    const cells=grid.rows[r].cells;
    for(let c=0;c<COLS;c++){
      set.has(pcOf(NOTES_LINEAR[c].replace(/\d+/,'')))
        ? cells[c].classList.remove('outkey')
        : cells[c].classList.add   ('outkey');
    }
  }
}

/* initial label render */
updateKeyLabels();

/* exports (globals) --------------------------------------------- */
Object.assign(window, {
  $, piano, grid, transport, midiBtn, calibBtn,
  wrap, cursor, lasso,
  labelCells, keySpans, keyTds,
  preview, updateKeyLabels
});
