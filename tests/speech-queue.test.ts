import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});
it("paces uncached synthesis requests without overlapping operations", async () => {
  vi.useFakeTimers();
  const { queueSpeech } = await import("../src/adapters/speech-queue");
  const starts: number[] = [];
  const work = () => {
    starts.push(Date.now());
    return Promise.resolve("ready");
  };
  const results = Promise.all([
    queueSpeech(work),
    queueSpeech(work),
    queueSpeech(work),
  ]);
  await vi.runAllTimersAsync();
  await expect(results).resolves.toEqual(["ready", "ready", "ready"]);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(21000);
  expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(21000);
});
it("cancels while waiting for quota without sending another request", async () => {
  vi.useFakeTimers();
  const { queueSpeech } = await import("../src/adapters/speech-queue");
  await queueSpeech(() => Promise.resolve());
  const operation = vi.fn(() => Promise.resolve());
  const controller = new AbortController();
  const cancelled = queueSpeech(operation, controller.signal).catch(
    (err) => err.name,
  );
  await vi.advanceTimersByTimeAsync(1);
  controller.abort();
  await vi.runAllTimersAsync();
  await expect(cancelled).resolves.toBe("AbortError");
  expect(operation).not.toHaveBeenCalled();
});
