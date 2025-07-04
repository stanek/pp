/* ================================================================
 *  Mouse / touch grid editing, fingering, selection
 * ===============================================================*/
const sel=new Set(), tmpSel=new Set();
let down=false, drag=false, sRow=0, sCol=0, hover=null;
const isNote = td => td.classList.contains('on') || td.classList.contains('blue');

/* prevent context-menu on right click */
grid.addEventListener('contextmenu', e=>e.preventDefault());

/*  hover / drag-select ------------------------------------------- */
grid.addEventListener('pointerover', e=>{
  hover=e.target.closest('td')||null;
  if(!down || !hover) return;
  const r=hover.parentNode.rowIndex, c=hover.cellIndex;
  if(!drag && (r!==sRow||c!==sCol)){ drag=true; lasso.style.display='block'; }
  if(drag){
    const [minR,maxR]=[Math.min(sRow,r),Math.max(sRow,r)],
          [minC,maxC]=[Math.min(sCol,c),Math.max(sCol,c)];
    Object.assign(lasso.style,{
      display:'block',left:minC*CELL_PX+'px',top:minR*CELL_PX+'px',
      width:(maxC-minC+1)*CELL_PX+'px',height:(maxR-minR+1)*CELL_PX+'px'
    });
    tmpSel.forEach(x=>x.classList.remove('selected')); tmpSel.clear();
    for(let R=minR;R<=maxR;R++){
      const cells=grid.rows[R].cells;
      for(let C=minC;C<=maxC;C++){
        const td=cells[C]; if(isNote(td)){ td.classList.add('selected'); tmpSel.add(td); }
      }
    }
  }
});
grid.addEventListener('pointerdown', e=>{
  const td=e.target.closest('td'); if(!td) return;
  down=true; drag=false; sRow=td.parentNode.rowIndex; sCol=td.cellIndex;
});
window.addEventListener('pointerup', e=>{
  if(!down) return; down=false;
  if(drag){
    drag=false; lasso.style.display='none';
    sel.clear(); tmpSel.forEach(td=>sel.add(td)); tmpSel.forEach(td=>preview(td.cellIndex)); tmpSel.clear(); saveAll(); return;
  }
  const td=hover; if(!td) return;
  if(sel.size){ sel.clear(); return; }

  if(e.button===2){ td.classList.toggle('blue'); td.classList.remove('on'); }
  else{ td.classList.toggle('on'); td.classList.remove('blue'); }
  if(isNote(td)) preview(td.cellIndex);
  clearFing(td); saveAll();
});

/* keyboard helpers ----------------------------------------------- */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    sel.clear(); grid.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));
    return;
  }
  if(sel.size && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    let dR=0,dC=0; if(e.key==='ArrowUp')dR=-1; if(e.key==='ArrowDown')dR=1;
    if(e.key==='ArrowLeft')dC=-1; if(e.key==='ArrowRight')dC=1;
    e.preventDefault();
    for(const td of sel){
      const r=td.parentNode.rowIndex+dR, c=td.cellIndex+dC;
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

  /* finger-number shortcuts */
  if(!hover || !isNote(hover)) return;
  if(['1','2','3','4','5'].includes(e.key)){ addFing(hover,e.key); saveAll(); }
  else{ clearFing(hover); saveAll(); }
});
