/**
 * Runs `worker` over `items` with a fixed number of workers in flight.
 *
 * One item failing never stops the run: a sync that loses one listing to a Google error
 * should still write the other three thousand.
 */
const runPool = async (items, worker, concurrency, onProgress) => {
  let index = 0;
  let done = 0;
  const run = async () => {
    while (index < items.length) {
      const i = index++;
      try {
        await worker(items[i], i);
      } catch (err) {
        console.error('[realtime] item failed:', err.message);
      }
      done += 1;
      if (onProgress && done % 25 === 0) await onProgress(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
  if (onProgress) await onProgress(done);
};

module.exports = { runPool };
