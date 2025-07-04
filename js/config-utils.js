/* ================================================================
 *  Global configuration, constants & shared helpers
 * ===============================================================*/

/* ---------- core constants -------------------------------------- */
const MAX_WS     = 10;
const OCTAVES    = [2,3,4,5];
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLE_ROOTS = ['A','C','D#','F#'];

const ROWS = 200;
const COLS = OCTAVES.length * NOTE_NAMES.length;
const CELL_PX = 26;
const ROW_PX  = CELL_PX + 1;
const PREVIEW_DUR = 0.25;
const STORE_KEY   = 'pianoSequencerWorkspaces';

/* ---------- note helpers ---------------------------------------- */
const pcOf = n => ({
  C:0,'B#':0,'C#':1,'Db':1,D:2,'D#':3,'Eb':3,E:4,'Fb':4,'E#':5,
  F:5,'F#':6,'Gb':6,G:7,'G#':8,'Ab':8,A:9,'A#':10,'Bb':10,B:11,'Cb':11
}[n]);

const NOTES_LINEAR = OCTAVES.flatMap(o => NOTE_NAMES.map(n => n + o));

const NAT_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJ   =[0,2,4,5,7,9,11];
const MIN   =[0,2,3,5,7,8,10];

const noteNameToMidi = n => {
  const m = n.match(/^([A-G]#?)(\d+)$/);
  return (+m[2] + 1) * 12 + NOTE_NAMES.indexOf(m[1]);
};
const midiToNoteName = n => NOTE_NAMES[n % 12] + (Math.floor(n/12) - 1);

/* ---------- Tone.js sampler ------------------------------------- */
const sampler = new Tone.Sampler({
  urls: Object.fromEntries(
    OCTAVES.flatMap(o => SAMPLE_ROOTS.map(n => [`${n}${o}`, n.replace('#','s')+o+'.mp3']))
  ),
  baseUrl: 'https://tonejs.github.io/audio/salamander/'
}).toDestination();

/* ================================================================
 *  NEW 🔸  Shared finger-number utilities + live-held notes set
 * ===============================================================*/

/* notes currently held by mouse or MIDI – shared across modules */
const manualHeld = new Set();

/* Render / clear two-digit fingering widgets inside a grid cell */
function renderFings(td){
  const d = (td.dataset.fing || '').slice(-2);   // keep last 2 digits
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

/* ---------------------------------------------------------------
 *  Expose everything that other modules need
 * --------------------------------------------------------------*/
Object.assign(window, {
  MAX_WS, OCTAVES, NOTE_NAMES, ROWS, COLS, CELL_PX, ROW_PX,
  PREVIEW_DUR, STORE_KEY,
  pcOf, NOTES_LINEAR, NAT_PC, MAJ, MIN,
  noteNameToMidi, midiToNoteName,
  sampler,
  manualHeld,          // 🔸 used by MIDI + mouse handlers
  renderFings          // 🔸 used by workspaces.js & grid-events.js
});
