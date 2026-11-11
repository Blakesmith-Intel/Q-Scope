export const SUPPORTED_LOOP_MINUTES =
  Object.freeze([
    30,
    60,
    90,
    120,
    150,
    180
  ]);

export function normaliseLoopMinutes(
  value
) {
  const minutes =
    Number(
      value
    );

  if (
    !SUPPORTED_LOOP_MINUTES
      .includes(
        minutes
      )
  ) {
    throw new RangeError(
      `Unsupported StormTracker loop window: ${value} minutes.`
    );
  }

  return minutes;
}

export function frameCountForLoopMinutes(
  value
) {
  return (
    normaliseLoopMinutes(
      value
    )
    / 5
    + 1 // Inclusive endpoints: 30 minutes means seven genuine 5-minute scans.
  );
}

// BoM-style visual cadence target. The precise BoM website timer is not
// published; this tuned target is intentionally not described as a measurement.
// Delay is per observed scan, NOT an additional wait after Cesium renders it.
export const RADAR_DEFAULT_INTERVAL_MS = 450;
export function playbackDelayForSpeed(value) {
  const speed=Number(value);
  if (![1,2,3].includes(speed)) {
    throw new RangeError(`Unsupported StormTracker playback speed: ${value}.`);
  }
  return Math.round(RADAR_DEFAULT_INTERVAL_MS/speed);
}
