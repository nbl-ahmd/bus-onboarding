/** Pace this phone's requests. The provider's project-wide quota remains authoritative. */
let tail: Promise<unknown> = Promise.resolve();
let lastStarted = 0;
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
}
export function queueSpeech<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
  interval = 21000,
): Promise<T> {
  const result = tail
    .catch(() => {})
    .then(async () => {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const delay = Math.max(0, lastStarted + interval - Date.now());
      if (delay) await wait(delay, signal);
      lastStarted = Date.now();
      return operation();
    });
  tail = result;
  return result;
}
