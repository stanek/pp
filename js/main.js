/* ================================================================
 *  Small glue layer – fires once everything else is parsed
 * ===============================================================*/
window.addEventListener('DOMContentLoaded', ()=>{
  /* live-update key labels when user changes tonic / mode */
  $('tonicSelect').addEventListener('change', updateKeyLabels);
  $('modeSelect' ).addEventListener('change', updateKeyLabels);

  /* simple mouse piano (same as before) */
  piano.addEventListener('pointerdown', e=>{
    const k=e.target.closest('.key'); if(!k) return;
    k.classList.add('held'); manualHeld.add(k.dataset.note);
    sampler.triggerAttack(k.dataset.note,Tone.now());
  });
  window.addEventListener('pointerup', ()=>{
    document.querySelectorAll('.key.held').forEach(k=>{
      k.classList.remove('held'); manualHeld.delete(k.dataset.note);
      sampler.triggerRelease(k.dataset.note,Tone.now());
    });
  });
});
