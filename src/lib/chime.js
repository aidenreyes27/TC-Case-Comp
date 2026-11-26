// Short two-note chime made with the Web Audio API (no sound files needed).
// Browsers only allow audio after the user has clicked something on the page,
// so the counter's "Sound on" button also unlocks it.
let ctx = null;
export function unlockAudio() {
  try {
    ctx = ctx ?? new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}
export function chime(kind = 'walkin') {
  if (!ctx) return;
  const notes = kind === 'group' ? [660, 880, 1100] : [700, 940];
  notes.forEach((f, i) => {
    const t = ctx.currentTime + i * 0.13;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
