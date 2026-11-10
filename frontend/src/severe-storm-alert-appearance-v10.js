// V10 operationally distinct *research candidate* symbology.
// Appearance must NEVER imply a confirmed surface gust or confirmed tornado.
export const V10_ALERT_APPEARANCES = Object.freeze({
  strong_radial_signature: Object.freeze({
    kind: "wind",
    shortLabel: "STRAIGHT-LINE WIND?",
    detailLabel: "Strong radial-wind signature candidate",
    icon: "v10-gust.svg",
    color: "#F6D94F",
    meaning: "High same-direction radar radial wind, not a measured surface gust."
  }),
  hook_shape_only: Object.freeze({
    kind: "hook",
    shortLabel: "HOOK ECHO?",
    detailLabel: "Possible hook-shaped reflectivity echo",
    icon: "v10-hook.svg",
    color: "#FF963F",
    meaning: "Curved reflectivity shape only, with no verified rotation."
  }),
  tornadic_candidate: Object.freeze({
    kind: "tornado",
    shortLabel: "TORNADIC CIRCULATION?",
    detailLabel: "Possible tornadic radar circulation",
    icon: "v10-tornado.svg",
    color: "#D83045",
    meaning: "Experimental hook and nearby radar velocity couplet; not a confirmed tornado."
  })
});
const UNCLASSIFIED = Object.freeze({
  kind: "unknown",
  shortLabel: "RADAR SIGNATURE?",
  detailLabel: "Unclassified experimental radar signature",
  icon: null,
  color: "#B7C6D0",
  meaning: "Unclassified research evidence; no operational warning classification."
});

export function severeAlertAppearance(alert) {
  const category = alert?.category;
  if (Object.hasOwn(V10_ALERT_APPEARANCES, category)) {
    return V10_ALERT_APPEARANCES[category];
  }
  // Legacy V9 research fixtures contain type only. Never promote to tornado.
  if (alert?.type === "wind") return V10_ALERT_APPEARANCES.strong_radial_signature;
  if (alert?.type === "hook") return V10_ALERT_APPEARANCES.hook_shape_only;
  return UNCLASSIFIED;
}
