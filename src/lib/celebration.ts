import confetti from "canvas-confetti";

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** A pleasant rising arpeggio "achievement" chime. */
function playChime() {
  const ctx = getCtx();
  if (!ctx) return;
  // Resume in case it was suspended (browser autoplay policy)
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  // C major-ish ascending: C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  // Gentle attack/release envelope on the master
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

  notes.forEach((freq, i) => {
    const t = now + i * 0.085;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.5);
  });

  // Sparkle on top
  const sparkleAt = now + 0.34;
  const sparkle = ctx.createOscillator();
  const sg = ctx.createGain();
  sparkle.type = "sine";
  sparkle.frequency.setValueAtTime(1568, sparkleAt);
  sparkle.frequency.exponentialRampToValueAtTime(2637, sparkleAt + 0.35);
  sg.gain.value = 0;
  sg.gain.linearRampToValueAtTime(0.18, sparkleAt + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.001, sparkleAt + 0.45);
  sparkle.connect(sg);
  sg.connect(master);
  sparkle.start(sparkleAt);
  sparkle.stop(sparkleAt + 0.5);
}

/** Big celebratory confetti burst with brand colors. */
function burstConfetti() {
  const colors = ["#06b6d4", "#22d3ee", "#0ea5e9", "#f59e0b", "#ffffff", "#a78bfa"];
  const defaults = { startVelocity: 45, spread: 360, ticks: 90, zIndex: 9999, colors };

  // Center burst
  confetti({ ...defaults, particleCount: 140, origin: { x: 0.5, y: 0.5 } });
  // Side cannons
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    confetti({ ...defaults, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }, 180);
  // Trailing sparkle
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 60, scalar: 0.7, origin: { x: 0.5, y: 0.4 } });
  }, 400);
}

/** Trigger the full dopamine-hit celebration. */
export function celebrate() {
  // Sound intentionally muted - visual confetti only.
  try { burstConfetti(); } catch {}
}
