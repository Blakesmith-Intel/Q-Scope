// Retry only missing WMTS tiles once rather than discarding an entire radar
// timestamp due to one transient HTTP/CORS failure. Never patch missing data
// with transparent tiles; a frame is accepted only after every tile is real.
export async function loadCompleteRadarTiles(tasks, fetchTile, {
  retries = 1,
  stopOnPermanent = false,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (!Array.isArray(tasks) || !tasks.length || typeof fetchTile !== "function") {
    throw new TypeError("A non-empty radar tile list and a loader are required");
  }
  const results = new Array(tasks.length);
  let pending = tasks.map((task, i) => ({ task, i }));
  for (let attempt = 0; attempt <= retries; attempt++) {
    const failures = [];
    // A 403 can affect ONE specific source tile while other tiles at this
    // exact observation UTC remain authentic and available. Collect/cache
    // them now; next source recovery needs only the refused original PNG.
    // Never present an incomplete mosaic or hammer a refused tile. Confirmed
    // unpublished UTC (400) and global rate-limit (429) still stop the batch.
    // Two at a time respects the existing global two-request pressure limit.
    const batchSize = stopOnPermanent ? 2 : pending.length;
    let permanent = false;
    for (let offset = 0; offset < pending.length; offset += batchSize) {
      const batch = pending.slice(offset, offset + batchSize);
      const loaded = await Promise.allSettled(
        batch.map(({ task }) => fetchTile(task.url))
      );
      loaded.forEach((record, i) => {
        const { task, i: index } = batch[i];
        if (record.status === "fulfilled" &&
            record.value?.width > 0 && record.value?.height > 0) {
          results[index] = { ...task, image: record.value };
        } else {
          failures.push({
            task,
            i: index,
            error: record.status === "rejected"
              ? record.reason?.message ?? String(record.reason)
              : "empty radar tile"
          });
        }
      });
      // Only a source-rejected UTC (400) or global rate-limit (429) makes
      // remaining tiles futile. A tile-specific 403 is not a global denial.
      permanent = stopOnPermanent && failures.some(({error}) =>
        /(?:HTTP\s+(?:400|429)\b|relay cooldown|queue full)/i.test(error));
      if (permanent) break;
    }
    if (!failures.length) return results;
    const refusedTile=stopOnPermanent && failures.some(({error}) =>
      /(?:HTTP\s+403\b|source refusal cooldown)/i.test(error));
    if (attempt === retries || permanent || refusedTile) {
      const details = failures.slice(0, 6).map(({ task, error }) =>
        "tile " + task.col + "/" + task.row + ": " + error
      ).join("; ");
      throw new Error("Incomplete BoM reflectivity mosaic: " +
        failures.length + "/" + tasks.length + " tiles unavailable after " +
        (attempt + 1) + " attempt(s); " + details +
        (permanent ? "; remaining tiles not requested after source refusal" : ""));
    }
    pending = failures.map(({ task, i }) => ({ task, i }));
    await wait(250);
  }
  throw new Error("Radar tile loading unexpectedly exhausted.");
}
