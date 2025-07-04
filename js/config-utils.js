/* ================================================================
 *  Global configuration, constants & utility helpers
 * ===============================================================*/
const MAX_WS = 10;

const OCTAVES      = [2,3,4,5];
const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
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
