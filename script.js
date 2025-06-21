/* ------------------------------------------------------------------
 * CONFIGURATION
 * ----------------------------------------------------------------*/
const MAX_WS = 10;                     // up to 10 workspaces
const OCTAVES = [2, 3, 4, 5];
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLE_ROOTS = ['A','C','D#','F#'];
const ROWS = 200, COLS = OCTAVES.length * NOTE_NAMES.length, CELL_PX = 26;
const PREVIEW_DUR = 0.25;              // seconds
const STORE_KEY = 'pianoSequencerWorkspaces';

/* ------------------------------------------------------------------
 * DOM SHORTCUTS
 * ----------------------------------------------------------------*/
const qs = id => document.getElementById(id);
const piano = qs('piano'), grid = qs('grid');
const playB = qs('playBtn'), pauseB = qs('pauseBtn'), stopB = qs('stopBtn');
const tempo = qs('tempo'), tonicSel = qs('tonicSelect'), modeSel = qs('modeSelect');
const addBtn = qs('addWS'), tabsBox = qs('tabs');

/* ------------------------------------------------------------------
 * HELPERS & ARRAYS
 * ----------------------------------------------------------------*/
const pcOf = n => ({
  C:0,'B#':0,'C#':1,'Db':1,D:2,'D#':3,'Eb':3,E:4,'Fb':4,'E#':5,F:5,'F#':6,'Gb':6,G:7,
  'G#':8,'Ab':8,A:9,'A#':10,'Bb':10,B:11,'Cb':11
}[n]);

const NOTES_LINEAR = OCTAVES.flatMap(o => NOTE_NAMES.map(n => n + o));
const COL_PC = NOTES_LINEAR.map(n => pcOf(n.replace(/\d+/, '')));
const NAT_PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJ = [0,2,4,5,7,9,11], MIN = [0,2,3,5,7,8,10];
const labelCells = [];                      // will fill in buildUI()

/* ------------------------------------------------------------------
 * WORKSPACE DATA
 * ----------------------------------------------------------------*/
let workspaces = [], current = 0;            // list and active index

function buildTabs() {
  tabsBox.innerHTML = '';
  workspaces.forEach((ws, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.textContent = ws.name;
    tab.onclick = () => {
      if (i === current) {                   // rename active tab
        const newName = prompt('Rename workspace:', ws.name);
        if (newName && newName.trim()) {
          ws.name = newName.trim();
          tab.textContent = ws.name;
          saveAll();
        }
      } else {                              // switch workspace
        activateTab(i);
      }
    };
    tabsBox.appendChild(tab);
  });
  [...tabsBox.children].forEach((el, i) => el.classList.toggle('active', i === current));
}

function saveAll() {
  workspaces[current].state = gatherState();
  localStorage.setItem(STORE_KEY, JSON.stringify(workspaces));
}

function activateTab(idx) {
  if (idx === current) return;
  saveAll();
  current = idx;
  buildTabs();
  applyState(workspaces[current].state);
}

function initWorkspaces() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) workspaces = stored;
  } catch {}
  if (!workspaces.length) workspaces = [{ name: 'Workspace 1', state: null }];
  buildTabs();
  applyState(workspaces[0].state);
}

addBtn.onclick = () => {
  if (workspaces.length >= MAX_WS) return;
  workspaces.push({ name: `Workspace ${workspaces.length + 1}`, state: null });
  buildTabs();
  activateTab(workspaces.length - 1);
};

/* ------------------------------------------------------------------
 * BUILD PIANO + GRID (one-time HTML)
 * ----------------------------------------------------------------*/
(function buildUI() {
  const rOct = piano.insertRow(), rLab = piano.insertRow(), rKey = piano.insertRow();
  OCTAVES.forEach(o => {
    const oc = rOct.insertCell(); oc.colSpan = NOTE_NAMES.length; oc.textContent = o; oc.className = 'octave';
    NOTE_NAMES.forEach(n => {
      const lab = rLab.insertCell(); lab.className = 'note'; labelCells.push(lab);
      const kc = rKey.insertCell();
      kc.innerHTML = `<div class="key ${n.includes('#') ? 'black' : 'white'}" data-note="${n + o}"></div>`;
    });
  });
  for (let r = 0; r < ROWS; r++) {
    const row = grid.insertRow();
    for (let c = 0; c < COLS; c++) row.insertCell();
  }
  grid.append(Object.assign(document.createElement('div'), { id: 'cursor' }),
              Object.assign(document.createElement('div'), { id: 'lasso'  }));
})();

const cursor = qs('cursor'), lasso = qs('lasso');

/* ------------------------------------------------------------------
 * AUDIO – Tone.js sampler
 * ----------------------------------------------------------------*/
const sampler = new Tone.Sampler({
  urls: Object.fromEntries(
    OCTAVES.flatMap(o => SAMPLE_ROOTS.map(n => [`${n}${o}`, n.replace('#', 's') + o + '.mp3']))
  ),
  baseUrl: 'https://tonejs.github.io/audio/salamander/'
}).toDestination();

const preview = col => sampler.triggerAttackRelease(NOTES_LINEAR[col], PREVIEW_DUR, Tone.now());

/* ------------------------------------------------------------------
 * SCALE LABELS & GRID SHADING
 * ----------------------------------------------------------------*/
function spelledScale(t, m) {
  const iv = m === 'minor' ? MIN : MAJ, root = pcOf(t);
  const letters = ['C','D','E','F','G','A','B'], idx = letters.indexOf(t[0]);
  const pcs = [], names = [];
  for (let i = 0; i < 7; i++) {
    const L = letters[(idx + i) % 7], nat = NAT_PC[L], tgt = (root + iv[i]) % 12;
    let d = (tgt - nat + 12) % 12; if (d > 6) d -= 12;
    let acc = ''; if (d === 1) acc='♯'; if (d === 2) acc='♯♯'; if (d === -1) acc='♭'; if (d === -2) acc='♭♭';
    pcs.push(tgt); names.push(L + acc);
  }
  return { pcs, names };
}

function updateKeyLabels() {
  const { pcs, names } = spelledScale(tonicSel.value, modeSel.value);
  const set = new Set(pcs), map = {}; names.forEach((n, i) => map[pcs[i]] = n);
  labelCells.forEach((cell, idx) => cell.textContent = map[COL_PC[idx]] ?? '');
  for (let r = 0; r < ROWS; r++) {
    const cells = grid.rows[r].cells;
    for (let c = 0; c < COLS; c++)
      set.has(COL_PC[c]) ? cells[c].classList.remove('outkey')
                         : cells[c].classList.add   ('outkey');
  }
  saveAll();
}
tonicSel.addEventListener('change', updateKeyLabels);
modeSel .addEventListener('change', updateKeyLabels);

/* ------------------------------------------------------------------
 * STATE SERIALISATION (green / blue / fingerings)
 * ----------------------------------------------------------------*/
function gatherState() {
  const green=[], blue=[], fing=[];
  for (let r=0;r<ROWS;r++){
    const cells=grid.rows[r].cells;
    for (let c=0;c<COLS;c++){
      const td=cells[c], idx=r*COLS+c;
      if (td.classList.contains('on'  )) green.push(idx);
      if (td.classList.contains('blue')) blue .push(idx);
      if (td.classList.contains('fingering')) fing.push([idx, td.textContent]);
    }}
  return { key:tonicSel.value, mode:modeSel.value, tempo:tempo.value, green, blue, fing };
}

function applyState(s) {
  /* clear grid */
  grid.querySelectorAll('.on,.blue,.fingering').forEach(td=>{
    td.classList.remove('on','blue','fingering');
    td.textContent='';
  });

  if (!s) { updateKeyLabels(); return; }

  tonicSel.value = s.key  || tonicSel.value;
  modeSel.value  = s.mode || modeSel.value;
  tempo.value    = s.tempo|| tempo.value;

  s.green?.forEach(i=>grid.rows[Math.floor(i/COLS)].cells[i%COLS].classList.add('on'));
  s.blue ?.forEach(i=>grid.rows[Math.floor(i/COLS)].cells[i%COLS].classList.add('blue'));
  s.fing ?.forEach(([i,d])=>{
    const td=grid.rows[Math.floor(i/COLS)].cells[i%COLS];
    td.classList.add('fingering'); td.textContent=d;
  });
  updateKeyLabels();
}

/* ------------------------------------------------------------------
 * INITIALISE WORKSPACES
 * ----------------------------------------------------------------*/
initWorkspaces();

/* ------------------------------------------------------------------
 * GRID INTERACTION
 * ----------------------------------------------------------------*/
const sel=new Set(); let tmp=new Set(); let down=false, drag=false, sRow=0,sCol=0, hover=null;
const isNote = td => td.classList.contains('on') || td.classList.contains('blue');

grid.addEventListener('contextmenu',e=>e.preventDefault());  // disable default menu

/* hover & lasso */
grid.addEventListener('pointerover',e=>{
  hover=e.target.closest('td')||null;
  if(!down||!hover)return;
  const r=hover.parentNode.rowIndex, c=hover.cellIndex;
  if(!drag && (r!==sRow||c!==sCol)){ drag=true; lasso.style.display='block'; }
  if(drag){
    const [minR,maxR]=[Math.min(sRow,r),Math.max(sRow,r)];
    const [minC,maxC]=[Math.min(sCol,c),Math.max(sCol,c)];
    Object.assign(lasso.style,{display:'block',left:minC*CELL_PX+'px',top:minR*CELL_PX+'px',
      width:(maxC-minC+1)*CELL_PX+'px',height:(maxR-minR+1)*CELL_PX+'px'});
    tmp.forEach(t=>t.classList.remove('selected')); tmp.clear();
    for(let R=minR;R<=maxR;R++){const cells=grid.rows[R].cells;
      for(let C=minC;C<=maxC;C++){const td=cells[C];
        if(isNote(td)){td.classList.add('selected'); tmp.add(td);} } }
  }
});

/* mouse down/up */
grid.addEventListener('pointerdown',e=>{
  const td=e.target.closest('td'); if(!td)return;
  down=true; drag=false; sRow=td.parentNode.rowIndex; sCol=td.cellIndex;
  if(sel.size) return;
});
window.addEventListener('pointerup',e=>{
  if(!down)return; down=false;
  if(drag){ drag=false; lasso.style.display='none';
    sel.clear(); tmp.forEach(t=>sel.add(t)); tmp.forEach(t=>preview(t.cellIndex));
    tmp.clear(); saveAll(); return; }
  const td=hover; if(!td) return;
  if(sel.size){ sel.clear(); return; }

  /* toggle colour */
  if(e.button===2){ td.classList.toggle('blue'); td.classList.remove('on');
    if(td.classList.contains('blue')) preview(td.cellIndex); }
  else            { td.classList.toggle('on'); td.classList.remove('blue');
    if(td.classList.contains('on'))  preview(td.cellIndex); }
  td.textContent=''; td.classList.remove('fingering');
  saveAll();
});

/* selection clearing outside grid */
document.addEventListener('pointerdown',e=>{ if(!grid.contains(e.target)) { sel.clear(); grid.querySelectorAll('.selected').forEach(td=>td.classList.remove('selected')); }});

/* keyboard actions */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ sel.clear(); grid.querySelectorAll('.selected').forEach(td=>td.classList.remove('selected')); return;}

  /* move */
  if(sel.size && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    let dR=0,dC=0;
    if(e.key==='ArrowUp')dR=-1; if(e.key==='ArrowDown')dR=1;
    if(e.key==='ArrowLeft')dC=-1; if(e.key==='ArrowRight')dC=1;
    e.preventDefault();
    for(const td of sel){const r=td.parentNode.rowIndex+dR,c=td.cellIndex+dC;
      if(r<0||r>=ROWS||c<0||c>=COLS)return;}
    const moves=[];
    sel.forEach(src=>{
      const r=src.parentNode.rowIndex,c=src.cellIndex;
      moves.push([src,grid.rows[r+dR].cells[c+dC],
                  src.classList.contains('blue'), src.textContent]);});
    moves.forEach(([s])=>{s.classList.remove('on','blue','fingering','selected'); s.textContent='';});
    moves.forEach(([,d,isBlue,f])=>{
      d.classList.add(isBlue?'blue':'on','selected');
      d.textContent=f||''; if(f) d.classList.add('fingering');});
    sel.clear(); moves.forEach(([,d])=>sel.add(d)); saveAll(); return;
  }

  /* fingering digits */
  if(!hover || !isNote(hover)) return;
  if(['1','2','3','4','5'].includes(e.key)){
    hover.textContent=e.key; hover.classList.add('fingering');
  }else{
    hover.textContent=''; hover.classList.remove('fingering');
  }
  saveAll();
});

/* ------------------------------------------------------------------
 * PLAYBACK (green or blue)
 * ----------------------------------------------------------------*/
let held=new Set(), rowPtr=0, timer=null;
function step(){
  held.forEach(n=>{
    const col=NOTES_LINEAR.indexOf(n);
    if(!grid.rows[rowPtr] || !isNote(grid.rows[rowPtr].cells[col])){
      sampler.triggerRelease(n,Tone.now()); held.delete(n);}});
  const cells=grid.rows[rowPtr].cells;
  for(let c=0;c<COLS;c++){
    if(isNote(cells[c]) && !held.has(NOTES_LINEAR[c])){
      sampler.triggerAttack(NOTES_LINEAR[c],Tone.now()); held.add(NOTES_LINEAR[c]);}}
  cursor.style.transform=`translateY(${rowPtr*CELL_PX}px)`; if(++rowPtr>=ROWS) stop();}
const play =()=>{if(timer)return; timer=setInterval(step,60000/(+tempo.value||120));};
const pause=()=>{if(!timer)return; clearInterval(timer); timer=null; held.forEach(n=>sampler.triggerRelease(n,Tone.now())); held.clear();};
const stop =()=>{pause(); rowPtr=0; cursor.style.transform='translateY(-2px)';};

/* ------------------------------------------------------------------
 * MANUAL PIANO PLAY
 * ----------------------------------------------------------------*/
piano.addEventListener('pointerdown',e=>{
  const k=e.target.closest('.key'); if(!k)return;
  k.classList.add('held'); sampler.triggerAttack(k.dataset.note,Tone.now());
});
window.addEventListener('pointerup',()=>{
  document.querySelectorAll('.key.held').forEach(k=>{k.classList.remove('held');
    sampler.triggerRelease(k.dataset.note,Tone.now());});
});

/* ------------------------------------------------------------------
 * TRANSPORT BUTTONS
 * ----------------------------------------------------------------*/
playB.addEventListener('click',play); pauseB.addEventListener('click',pause); stopB.addEventListener('click',stop);
