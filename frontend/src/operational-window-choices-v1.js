import { DOPPLER_AVAILABLE_LOOP_VALUE } from "./doppler-available-window-v1.js";

// Operator-approved native BoM rain playback: display the current published
// 30-minute / up-to-six-scan window only. Do not advertise browser archives.
// The independent Doppler all-available option remains untouched.
export const RAIN_ONLY_LOOP_MINUTES = Object.freeze([30]);

export function buildOperationalWindowChoices({
  combinedAvailable = false,
  rainAvailableMinutes = [],
  rainHasFrames = false
} = {}) {
  const available = new Set(rainAvailableMinutes.map(Number));
  return [
    {
      value: DOPPLER_AVAILABLE_LOOP_VALUE,
      label: "Doppler — All available",
      disabled: !combinedAvailable
    },
    ...RAIN_ONLY_LOOP_MINUTES.map(minutes => ({
      value: String(minutes),
      label: "30 min — Rain radar (BoM published scans)",
      disabled: !(rainHasFrames || available.has(30))
    }))
  ];
}
