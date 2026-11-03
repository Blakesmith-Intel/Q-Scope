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
    // A source-denied mosaic cannot be used. With the production permanent-
    // refusal guard enabled, stop requesting further tiles after the first
    // refused pair rather than draining the remaining WMTS queue pointlessly.
    // Two at a time matches the existing global two-request pressure limit.
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
      // A 400 means BoM rejected the UTC/tile; 403/429 means access denied.
      // Neither can be repaired by fetching more tiles for this SAME frame.
      permanent = stopOnPermanent && failures.some(({error}) =>
        /(?:HTTP\s+(?:400|403|429)\b|relay cooldown|queue full)/i.test(error));
      if (permanent) break;
    }
    if (!failures.length) return results;
    if (attempt === retries || permanent) {
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
