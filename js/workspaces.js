/* ================================================================
 *  Workspaces: save / load / tabs + Clear & Delete buttons
 * ===============================================================*/
let workspaces = [];
let current    = 0;

/* DOM helpers provided globally by ui-build.js */
const addBtn    = document.getElementById('addWS');
const clearBtn  = document.getElementById('clearWS');
const deleteBtn = document.getElementById('deleteWS');
const tabsBox   = document.getElementById('tabs');

/* ----------------------------------------------------------------
 *  State helpers
 * ---------------------------------------------------------------*/
function gatherState(){
  const g=[], b=[], f=[];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const td = grid.rows[r].cells[c], idx = r*COLS + c;
    if (td.classList.contains('on'))   g.push(idx);
    if (td.classList.contains('blue')) b.push(idx);
    if (td.dataset.fing)               f.push([idx, td.dataset.fing]);
  }
  return {
    key      : document.getElementById('tonicSelect').value,
    mode     : document.getElementById('modeSelect').value,
    tempo    : document.getElementById('tempo').value,
    playMode : document.getElementById('playMode').value,
    green:g, blue:b, fings:f
  };
}

function applyState(st){
  /* wipe grid */
  grid.querySelectorAll('td').forEach(td=>{
    td.classList.remove('on','blue','fingering','selected');
    td.innerHTML='';
    delete td.dataset.fing;
  });

  if (!st){ updateKeyLabels(); return; }

  document.getElementById('tonicSelect').value = st.key;
  document.getElementById('modeSelect' ).value = st.mode;
  document.getElementById('tempo'      ).value = st.tempo;
  document.getElementById('playMode'   ).value = st.playMode;

  st.green.forEach(i => grid.rows[i/COLS|0].cells[i%COLS].classList.add('on'));
  st.blue .forEach(i => grid.rows[i/COLS|0].cells[i%COLS].classList.add('blue'));
  st.fings.forEach(([i,d])=>{
    const td = grid.rows[i/COLS|0].cells[i%COLS];
    td.dataset.fing = d; renderFings(td);
  });

  updateKeyLabels();
}

/* persist to localStorage */
function saveAll(){
  workspaces[current].state = gatherState();
  localStorage.setItem(STORE_KEY, JSON.stringify(workspaces));
}

/* ----------------------------------------------------------------
 *  Tab UI
 * ---------------------------------------------------------------*/
function buildTabs(){
  tabsBox.innerHTML = '';
  workspaces.forEach((ws,i)=>{
    const t = document.createElement('div');
    t.className = 'tab';
    t.textContent = ws.name;
    t.onclick = () =>
      (i === current ? renameTab(i,t) : activateTab(i));
    tabsBox.appendChild(t);
  });
  [...tabsBox.children].forEach((el,i)=>
    el.classList.toggle('active', i === current));
}

function renameTab(i,node){
  const n = prompt('Rename workspace:', workspaces[i].name);
  if (n && n.trim()){
    workspaces[i].name = n.trim();
    node.textContent   = n.trim();
    saveAll();
  }
}

function activateTab(i){
  window.stop();          // from playback-engine.js
  saveAll();
  current = i;
  buildTabs();
  applyState(workspaces[i].state);
}

/* ----------------------------------------------------------------
 *  Button actions
 * ---------------------------------------------------------------*/
addBtn.onclick = () => {
  if (workspaces.length >= MAX_WS) return;
  workspaces.push({ name:`Workspace ${workspaces.length+1}`, state:null });
  buildTabs();
  activateTab(workspaces.length - 1);
};

clearBtn.onclick = () => {
  if (!workspaces.length) return;
  if (!confirm('Clear all notes and fingerings in this workspace?')) return;

  workspaces[current].state = null;
  applyState(null);
  saveAll();
};

deleteBtn.onclick = () => {
  if (workspaces.length <= 1){
    alert('You must have at least one workspace.');
    return;
  }
  if (!confirm(`Delete workspace "${workspaces[current].name}"?`)) return;

  workspaces.splice(current, 1);
  if (current >= workspaces.length) current = workspaces.length - 1;
  buildTabs();
  applyState(workspaces[current].state);
  saveAll();
};

/* ----------------------------------------------------------------
 *  Bootstrap
 * ---------------------------------------------------------------*/
(function init(){
  try{
    workspaces = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  }catch{ workspaces = []; }

  if (!workspaces.length)
    workspaces = [{ name:'Workspace 1', state:null }];

  buildTabs();
  applyState(workspaces[0].state);
})();
