/* ================================================================
 *  Workspace save / load / tabs
 * ===============================================================*/
let workspaces = [], current = 0;

function gatherState(){
  const g=[], b=[], f=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const td=grid.rows[r].cells[c], idx=r*COLS+c;
    if(td.classList.contains('on'))   g.push(idx);
    if(td.classList.contains('blue')) b.push(idx);
    if(td.dataset.fing) f.push([idx, td.dataset.fing]);
  }
  return {
    key:$('tonicSelect').value,
    mode:$('modeSelect').value,
    tempo:$('tempo').value,
    playMode:$('playMode').value,
    green:g, blue:b, fings:f
  };
}
function applyState(st){
  grid.querySelectorAll('td').forEach(td=>{
    td.classList.remove('on','blue','fingering','selected');
    td.innerHTML=''; delete td.dataset.fing;
  });
  if(!st){ updateKeyLabels(); return; }

  $('tonicSelect').value = st.key;
  $('modeSelect' ).value = st.mode;
  $('tempo'      ).value = st.tempo;
  $('playMode'   ).value = st.playMode;
  st.green.forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('on'));
  st.blue .forEach(i=>grid.rows[i/COLS|0].cells[i%COLS].classList.add('blue'));
  st.fings.forEach(([i,d])=>{
    const td=grid.rows[i/COLS|0].cells[i%COLS];
    td.dataset.fing=d; renderFings(td);
  });
  updateKeyLabels();
}
function saveAll(){
  workspaces[current].state=gatherState();
  localStorage.setItem(STORE_KEY, JSON.stringify(workspaces));
}

/* tabs ----------------------------------------------------------- */
const tabsBox=$('tabs'), addBtn=$('addWS');
function buildTabs(){
  tabsBox.innerHTML='';
  workspaces.forEach((ws,i)=>{
    const t=document.createElement('div');
    t.className='tab'; t.textContent=ws.name;
    t.onclick = ()=> (i===current
        ? renameTab(i,t) : activateTab(i));
    tabsBox.appendChild(t);
  });
  [...tabsBox.children].forEach((el,i)=>el.classList.toggle('active', i===current));
}
function renameTab(i,node){
  const n=prompt('Rename workspace:', workspaces[i].name);
  if(n && n.trim()){ workspaces[i].name=n.trim(); node.textContent=n; saveAll(); }
}
function activateTab(i){
  window.stop();                    // from playback-engine.js
  saveAll(); current=i; buildTabs(); applyState(workspaces[i].state);
}

/* bootstrap ------------------------------------------------------ */
(function init(){
  try{ workspaces = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch{}
  if(!workspaces.length) workspaces=[{name:'Workspace 1', state:null}];
  buildTabs(); applyState(workspaces[0].state);
})();
addBtn.onclick = ()=> {
  if(workspaces.length >= MAX_WS) return;
  workspaces.push({name:`Workspace ${workspaces.length+1}`, state:null});
  buildTabs(); activateTab(workspaces.length-1);
};

/* expose for other modules */
window.saveAll = saveAll;
