/** Best-effort web feedback. Unsupported browsers (including iOS Safari) do nothing. */
export interface HapticsAdapter {
  pulse(kind: "tap" | "play" | "stop" | "complete", enabled: boolean): void;
}
export class BrowserHapticsAdapter implements HapticsAdapter {
  pulse(kind: "tap" | "play" | "stop" | "complete", enabled: boolean) {
    if (
      !enabled ||
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    )
      return;
    const patterns = {
      tap: 8,
      play: 16,
      stop: [15, 35, 15],
      complete: [8, 45, 8],
    };
    try {
      navigator.vibrate(patterns[kind]);
    } catch {
      /* Feedback must never block a control. */
    }
  }
}
export const haptics = new BrowserHapticsAdapter();
