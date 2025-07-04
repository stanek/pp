/* =====================================================================
 *  CONFIG-UTILS
 *  ─ Global constants, shared helpers, Tone.js sampler, and exports
 * ====================================================================*/

/* ---------------------------------------------------------------------
 *  Octave setup
 * --------------------------------------------------------------------*/
const ALL_OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];   // full 88-key span
let   vStart      = 2;                             // first visible octave
let   vEnd        = 5;                             // last  visible octave

/* ---------------------------------------------------------------------
 *  Core constants
 * --------------------------------------------------------------------*/
const MAX_WS     = 10;
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLE_ROOTS = ['A','C','D#','F#'];          // samples available in set

const ROWS = 200;
const COLS = ALL_OCTAVES.length * NOTE_NAMES.length;   // 9 × 12 = 108 columns
const CELL_PX = 26;
const ROW_PX  = CELL_PX + 1;
const PREVIEW_DUR = 0.25;
const STORE_KEY   = 'pianoSequencerWorkspaces';

/* ---------------------------------------------------------------------
 *  Music-theory helpers
 * --------------------------------------------------------------------*/
const pcOf = n => ({
  C:0,'B#':0,'C#':1,'Db':1,D:2,'D#':3,'Eb':3,E:4,'Fb':4,'E#':5,
  F:5,'F#':6,'Gb':6,G:7,'G#':8,'Ab':8,A:9,'A#':10,'Bb':10,B:11,'Cb':11
}[n]);

const NOTES_LINEAR = ALL_OCTAVES.flatMap(o => NOTE_NAMES.map(n => n + o));

const NAT_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJ   =[0,2,4,5,7,9,11];
const MIN   =[0,2,3,5,7,8,10];

const noteNameToMidi = n => {
  const m = n.match(/^([A-G]#?)(\d+)$/);
  return (+m[2] + 1) * 12 + NOTE_NAMES.indexOf(m[1]);
};
const midiToNoteName = m => NOTE_NAMES[m % 12] + (Math.floor(m/12) - 1);

/* ---------------------------------------------------------------------
 *  Tone.js Sampler  (limit to octaves 1-7; Salamander lacks others)
 * --------------------------------------------------------------------*/
const VALID_OCTS = ALL_OCTAVES.filter(o => o >= 1 && o <= 7);

const sampler = new Tone.Sampler({
  urls: Object.fromEntries(
    VALID_OCTS.flatMap(o =>
      SAMPLE_ROOTS.map(root => [
        `${root}${o}`,
        root.replace('#','s') + o + '.mp3'
      ])
    )
  ),
  baseUrl: 'https://tonejs.github.io/audio/salamander/'
}).toDestination();

/* ---------------------------------------------------------------------
 *  Shared note/fingering state
 * --------------------------------------------------------------------*/
const manualHeld = new Set();                     // live notes (mouse + MIDI)

/* Draw fingering digits inside a grid cell */
function renderFings(td){
  const d = (td.dataset.fing || '').slice(-2);    // keep last 2 chars
  if (!d){
    td.innerHTML = '';
    td.classList.remove('fingering');
    return;
  }
  td.innerHTML = (d.length === 1)
    ? `<div class="fing single">${d}</div>`
    : `<div class="fing top">${d[0]}</div><div class="fing bot">${d[1]}</div>`;
  td.classList.add('fingering');
}

/* Clear fingering from a grid cell (exported for grid-events.js) */
function clearFing(td){
  delete td.dataset.fing;
  td.innerHTML = '';
  td.classList.remove('fingering');
}

/* ---------------------------------------------------------------------
 *  Visible-column helper used by many modules
 * --------------------------------------------------------------------*/
const colVisible = col => {
  const oct = ALL_OCTAVES[Math.floor(col / NOTE_NAMES.length)];
  return oct >= vStart && oct <= vEnd;
};

/* ---------------------------------------------------------------------
 *  Export everything other modules rely on
 * --------------------------------------------------------------------*/
Object.assign(window, {
  /* octave window (these mutate elsewhere) */
  ALL_OCTAVES, vStart, vEnd,

  /* numeric constants */
  MAX_WS, NOTE_NAMES, ROWS, COLS, CELL_PX, ROW_PX,
  PREVIEW_DUR, STORE_KEY,

  /* helpers & look-ups */
  pcOf, NOTES_LINEAR, NAT_PC, MAJ, MIN,
  noteNameToMidi, midiToNoteName,

  /* audio + live state */
  sampler, manualHeld, renderFings, clearFing,

  /* visibility */
  colVisible
});
