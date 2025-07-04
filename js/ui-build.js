/* ======================================================================
 *  UI-BUILD  — constructs:
 *    • full 88-key piano header (octave row, note letters, keycaps)
 *    • 200 × 108 sequencer grid
 *    • range-handle overlays (+ / –) that slide the visible octave window
 *    • cursor, lasso, and preview helpers
 * =====================================================================*/

/* shorthand DOM helper */
const $ = id => document.getElementById(id);

/* main DOM nodes that already exist in index.html */
const piano      = $('piano');
const grid       = $('grid');
const transport  = $('transport');

/* ------------------------------------------------------------------ */
/*  Transport-bar MIDI buttons (created once if they aren’t in HTML)  */
/* ------------------------------------------------------------------ */
const midiBtn  = $('midiBtn') || Object.assign(
  document.createElement('button'),
  { id:'midiBtn', textContent:'Connect Piano', style:'background:green' }
);
const calibBtn = $('calibBtn') || Object.assign(
  document.createElement('button'),
  { id:'calibBtn', textContent:'Calibrate', disabled:true }
);

if (!midiBtn.parentNode)  transport.prepend(midiBtn);
if (!calibBtn.parentNode) transport.insertBefore(calibBtn, midiBtn.nextSibling);

/* ------------------------------------------------------------------ */
/*  Range-handle “buttons” (styled divs)                              */
/* ------------------------------------------------------------------ */
const leftDec   = Object.assign(document.createElement('div'),
                  { className:'rangeBtn', textContent:'–' });
const leftInc   = Object.assign(document.createElement('div'),
                  { className:'rangeBtn', textContent:'+' });
const rightDec  = Object.assign(document.createElement('div'),
                  { className:'rangeBtn', textContent:'–' });
const rightInc  = Object.assign(document.createElement('div'),
                  { className:'rangeBtn', textContent:'+' });

/* ------------------------------------------------------------------ */
/*  Arrays to keep references to each column’s cells/spans            */
/* ------------------------------------------------------------------ */
const labelCells = [];   // <td> elements in note-letter row
const keySpans   = [];   // <span> bottom labels in keycaps
const keyTds     = [];   // <td> elements that hold each keycap

/* ------------------------------------------------------------------ */
/*  Build the piano header and key rows                               */
/* ------------------------------------------------------------------ */
(function buildHeader() {

  /* octave-number row */
  const rOct = piano.insertRow();

  /* note-letter row (C, C#, D…) */
  const rLab = piano.insertRow();

  /* keycap row (div.key) */
  const rKey = piano.insertRow();

  /* one <td colSpan=12> per octave */
  ALL_OCTAVES.forEach(o => {

    /* octave number cell */
    const oc = rOct.insertCell();
    oc.colSpan   = NOTE_NAMES.length;
    oc.className = 'octNum';
    oc.textContent = o;

    /* per-note cells underneath */
    NOTE_NAMES.forEach(n => {
      /* note-letter row */
      const lab = rLab.insertCell();
      lab.className = 'note';
      labelCells.push(lab);

      /* keycap row */
      const td  = rKey.insertCell();
      keyTds.push(td);

      const div = document.createElement('div');
      div.className   = `key ${n.includes('#') ? 'black' : 'white'}`;
      div.dataset.note = n + o;

      const span = document.createElement('span');
      span.className = 'botlabel';
      div.appendChild(span);
      td.appendChild(div);

      keySpans.push(span);
    });
  });

})();

/* ------------------------------------------------------------------ */
/*  Build the 200 × 108 sequencer grid                                */
/* ------------------------------------------------------------------ */
for (let r = 0; r < ROWS; r++) {
  const row = grid.insertRow();
  for (let c = 0; c < COLS; c++) row.insertCell();
}

/* ------------------------------------------------------------------ */
/*  Wrap the grid for vertical scrolling + insert playhead + lasso    */
/* ------------------------------------------------------------------ */
const wrap = document.createElement('div');
wrap.id = 'gridWrap';
Object.assign(wrap.style, {
  position:'relative',
  display :'inline-block',
  overflow :'hidden'
});
grid.parentNode.insertBefore(wrap, grid);
wrap.appendChild(grid);

/* red playhead cursor */
const cursor = document.createElement('div');
cursor.id = 'cursor';
Object.assign(cursor.style, {
  position:'absolute',
  top:0, left:0, width:'100%', height:'2px',
  background:'red',
  pointerEvents:'none',
  transform:'translateY(-2px)',
  transition:'transform 0ms linear',
  zIndex:9999
});
wrap.appendChild(cursor);

/* selection lasso rectangle */
const lasso = document.createElement('div');
lasso.id = 'lasso';
wrap.appendChild(lasso);

/* ------------------------------------------------------------------ */
/*  RANGE-HANDLE OVERLAYS (absolutely positioned)                     */
/* ------------------------------------------------------------------ */
const container = $('pianoContainer');           // wrapper added in index.html
container.style.position = 'relative';           // anchor point

const leftWrap  = Object.assign(document.createElement('div'),
                    { className:'rangeWrap left'  });
const rightWrap = Object.assign(document.createElement('div'),
                    { className:'rangeWrap right' });

leftWrap.append(leftDec, leftInc);
rightWrap.append(rightDec, rightInc);
container.append(leftWrap, rightWrap);

/* ------------------------------------------------------------------ */
/*  Show/hide columns based on visible octave window                  */
/* ------------------------------------------------------------------ */
function applyRangeVisibility() {
  /* grid + piano rows */
  for (let c = 0; c < COLS; c++) {
    const vis  = colVisible(c);
    const m    = vis ? 'remove' : 'add';
    keyTds[c].classList[m]   ('hiddenCol');
    labelCells[c].classList[m]('hiddenCol');
    for (let r = 0; r < ROWS; r++)
      grid.rows[r].cells[c].classList[m]('hiddenCol');
  }

  /* octave numbers */
  document.querySelectorAll('.octNum').forEach((td, i) => {
    const oct = ALL_OCTAVES[i];
    td.classList.toggle('hiddenCol', oct < vStart || oct > vEnd);
  });
}

/*  Button interactions ------------------------------------------ */
leftInc .onclick = () => { if (vStart > 0)             { vStart--; applyRangeVisibility(); } };
leftDec .onclick = () => { if (vEnd - vStart > 0)      { vStart++; applyRangeVisibility(); } };
rightInc.onclick = () => { if (vEnd < 8)               { vEnd++;   applyRangeVisibility(); } };
rightDec.onclick = () => { if (vEnd - vStart > 0)      { vEnd--;   applyRangeVisibility(); } };

/* initial hide pass */
applyRangeVisibility();

/* ------------------------------------------------------------------ */
/*  Key-label colouring & scale helper                                */
/* ------------------------------------------------------------------ */
function spelledScale(tonic, mode) {
  const iv = mode === 'minor' ? MIN : MAJ;
  const root = pcOf(tonic),
        letters = ['C','D','E','F','G','A','B'],
        idx = letters.indexOf(tonic[0]),
        pcs = [], names = [];

  for (let i = 0; i < 7; i++) {
    const L   = letters[(idx+i) % 7],
          nat = NAT_PC[L],
          tgt = (root + iv[i]) % 12;
    let d = (tgt - nat + 12) % 12; if (d > 6) d -= 12;
    const acc = { 1:'♯', 2:'♯♯', '-1':'♭', '-2':'♭♭' }[d] || '';
    pcs.push(tgt); names.push(L + acc);
  }
  return { pcs, names };
}

function updateKeyLabels() {
  const tonic = $('tonicSelect').value,
        mode  = $('modeSelect').value,
        { pcs, names } = spelledScale(tonic, mode),
        set  = new Set(pcs),
        map  = {};

  names.forEach((n, i) => map[pcs[i]] = n);

  /* note-letter row */
  labelCells.forEach((td, i) => {
    const pc = pcOf(NOTES_LINEAR[i].replace(/\d+/, ''));
    td.textContent = map[pc] || '';
  });

  /* colour the grid */
  for (let r = 0; r < ROWS; r++) {
    const cells = grid.rows[r].cells;
    for (let c = 0; c < COLS; c++) {
      const pc  = pcOf(NOTES_LINEAR[c].replace(/\d+/, '')),
            mode = set.has(pc) ? 'remove' : 'add';
      cells[c].classList[mode]('outkey');
    }
  }
}

/* quick preview helper */
const preview = col =>
  sampler.triggerAttackRelease(NOTES_LINEAR[col], PREVIEW_DUR, Tone.now());

/* ------------------------------------------------------------------ */
/*  Export globals for other modules                                 */
/* ------------------------------------------------------------------ */
Object.assign(window, {
  $, piano, grid, transport,
  midiBtn, calibBtn,
  labelCells, keySpans, keyTds,
  wrap, cursor, lasso,
  preview, updateKeyLabels,
  applyRangeVisibility, colVisible
});
