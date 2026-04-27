/**
 * Lightweight sound feedback for notifications using the Web Audio API.
 * No external assets — synthesized in-process. Only plays when the user
 * has enabled notification sounds via the Notifications settings tab.
 */

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new window.AudioContext();
    } catch {
      return null;
    }
  }
  return audioContext;
};

const FREQ_BY_TYPE: Record<NotificationSoundType, number> = {
  success: 880,
  info: 660,
  warning: 440,
  error: 220,
};

export type NotificationSoundType = 'success' | 'info' | 'warning' | 'error';

export const playNotificationSound = (type: NotificationSoundType): void => {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = FREQ_BY_TYPE[type];
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Sound is best-effort — never let audio failures bubble up
  }
};
