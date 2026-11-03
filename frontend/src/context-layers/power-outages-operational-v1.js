import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
import {addOfficialSourceRow,powerOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {createPowerOutageSuburbExplorer} from "./power-outage-suburb-explorer-v1.js?v=council-customers-20261017-v1";
import {
  createPowerOutageLayer,
  powerOutageSummary
} from "./power-outages-v1.js?v=background-incident-refresh-20261017-v1";

const $ = id =>
  document.getElementById(id);

function setPowerStatus({
  kind = "normal",
  message = ""
} = {}) {
  const target =
    $("powerOutageStatus");

  if (!target) {
    return;
  }

  target.textContent =
    message
    || "Energex + Ergon + Essential Energy | unplanned outages";

  target.dataset.kind =
    kind;
}

export function formatPowerOutageTime(value,provider="Energex"){
  return formatAgencyTimestamp(value,provider);
}

function addDetailRow(
  container,
  label,
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return;
  }

  const labelNode =
    document.createElement(
      "span"
    );

  labelNode.textContent =
    label;

  const valueNode =
    document.createElement(
      "strong"
    );

  valueNode.textContent =
    text;

  container.append(
    labelNode,
    valueNode
  );
}

function showPowerOutageInfo(
  feature
) {
  const panel =
    $("powerOutageInfo");

  const rows =
    $("powerOutageInfoRows");

  const title =
    $("powerOutageInfoTitle");

  const kicker =
    $("powerOutageInfoKicker");

  if (
    !panel
    || !rows
    || !title
  ) {
    return;
  }

  if (!feature) {
    panel.hidden =
      true;

    panel.dataset
      .outageId =
      "";

    return;
  }

  const summary =
    powerOutageSummary(
      feature
    );

  $("floodRoadClosureInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("riverGaugeInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("qfdTechnicalRescueInfo")?.setAttribute("hidden","");

  panel.dataset
    .outageId =
    String(
      summary.id
      ?? ""
    );

  panel.dataset
    .outageType =
    summary.type
      .toLowerCase();

  title.textContent =
    summary.suburbs
    || `Event ${summary.eventId || summary.id}`;

  if (kicker) {
    kicker.textContent =
      `${summary.type} POWER OUTAGE`;
  }

  rows.replaceChildren();

  addDetailRow(
    rows,
    "Provider",
    summary.provider
  );

  addDetailRow(
    rows,
    "Customers affected",
    summary.customersAffected
      .toLocaleString(
        "en-AU"
      )
  );

  addDetailRow(
    rows,
    "Status",
    summary.status
  );

  addDetailRow(
    rows,
    "Suburbs",
    summary.suburbs
  );

  addDetailRow(
    rows,
    "Streets",
    summary.streets
  );

  addDetailRow(
    rows,
    "Reason",
    summary.reason
  );

  addDetailRow(
    rows,
    "Started",
    formatPowerOutageTime(
      summary.start,
      summary.provider
    )
  );

  addDetailRow(
    rows,
    "Estimated restoration",
    formatPowerOutageTime(
      summary.estimatedFix,
      summary.provider
    )
  );

  addDetailRow(
    rows,
    "Scheduled finish",
    formatPowerOutageTime(
      summary.finish,
      summary.provider
    )
  );

  addDetailRow(
    rows,
    "Feed updated",
    formatPowerOutageTime(
      summary.extracted,
      summary.provider
    )
  );

  addOfficialSourceRow(rows,"Source",summary.attribution,
    powerOfficialUrl(summary.provider));

  panel.hidden =
    false;
}

export function powerOutageEntityFromPick(
  picked
) {
  return (
    picked?.id
    ?? picked?.primitive?.id
    ?? null
  );
}

export function powerOutageIdFromPick(
  picked
) {
  const entity =
    powerOutageEntityFromPick(
      picked
    );

  const id =
    entity
      ?.stormTrackerPowerOutageId;

  return id
    ? String(id)
    : "";
}

function outageIdNearPosition({
  viewer,
  position,
  width = 28,
  height = 28
}) {
  if (
    !viewer
    || !position
  ) {
    return "";
  }

  const picks =
    typeof viewer.scene
      .drillPick === "function"
      ? viewer.scene.drillPick(
          position,
          24,
          width,
          height
        )
      : [];

  for (
    const picked
    of picks
  ) {
    const outageId =
      powerOutageIdFromPick(
        picked
      );

    if (outageId) {
      return outageId;
    }
  }

  const picked =
    viewer.scene.pick(
      position,
      width,
      height
    );

  return powerOutageIdFromPick(
    picked
  );
}

export function initialiseOperationalPowerOutages({
  viewer,
  mapCamera,
  CesiumRef =
    globalThis.Cesium
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Operational power-outage UI requires Cesium and a viewer."
    );
  }

  const checkbox =
    $("showPowerOutages");

  const panel =
    $("powerOutageInfo");

  const canvas =
    viewer.scene.canvas;

  const mapContainer =
    $("cesiumContainer")
    ?? canvas.parentElement;

  // The sidebar explorer observes this SAME unplanned-outage snapshot,
  // with no second fetch loop or additional map entity source.
  let layer;
  const explorer = createPowerOutageSuburbExplorer({
    viewer,CesiumRef,mapCamera,formatTime:formatPowerOutageTime,
    refresh:()=>layer.refresh({force:true}),
    getLoadedAt:()=>layer?.lastLoadedAt??0
  });

  layer =
    createPowerOutageLayer({
      viewer,
      CesiumRef,

      visible:
        Boolean(
          checkbox?.checked
        ),
      refreshWhileHidden: true,

      onStatus:
        status => {
          setPowerStatus(status);
          explorer.updateStatus(status);
        },

      onUpdate:
        (features,mappedFeatures=features) => {
          // Explorer sees every current QLD provider incident, even if a
          // source did not provide map geometry; the map never fabricates it.
          explorer.updateFeatures(features);
          if (
            !panel
            || panel.hidden
          ) {
            return;
          }

          const selectedId =
            panel.dataset
              .outageId
            || "";

          if (
            selectedId
            && !mappedFeatures.some(
              feature =>
                String(
                  feature.id
                )
                === selectedId
            )
          ) {
            showPowerOutageInfo(
              null
            );
          }
        }
    });

  function showById(
    outageId
  ) {
    if (!outageId) {
      return false;
    }

    const feature =
      layer.featureById(
        outageId
      );

    if (!feature) {
      return false;
    }

    showPowerOutageInfo(
      feature
    );

    return true;
  }

  function canvasPositionFromPointer(
    event
  ) {
    const rect =
      canvas
        .getBoundingClientRect();

    return new CesiumRef
      .Cartesian2(
        event.clientX
          - rect.left,
        event.clientY
          - rect.top
      );
  }

  function selectNearPosition(
    position,
    {
      width = 30,
      height = 30
    } = {}
  ) {
    return showById(
      outageIdNearPosition({
        viewer,
        position,
        width,
        height
      })
    );
  }

  const pointerTap =
    {
      id:
        null,

      x:
        0,

      y:
        0,

      startedAt:
        0,

      moved:
        false
    };

  const onPointerDown =
    event => {
      if (
        event.button !== undefined
        && event.button !== 0
      ) {
        return;
      }

      if (
        !mapContainer
        || !mapContainer
          .contains(
            event.target
          )
      ) {
        return;
      }

      const blockedControl =
        event.target
          ?.closest?.(
            "#nav,#powerOutageInfo,#floodRoadClosureInfo,#riverGaugeInfo,#qfdTechnicalRescueInfo"
          );

      if (blockedControl) {
        return;
      }

      pointerTap.id =
        event.pointerId;

      pointerTap.x =
        event.clientX;

      pointerTap.y =
        event.clientY;

      pointerTap.startedAt =
        performance.now();

      pointerTap.moved =
        false;
    };

  const onPointerMove =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      if (
        Math.hypot(
          event.clientX
            - pointerTap.x,
          event.clientY
            - pointerTap.y
        ) > 12
      ) {
        pointerTap.moved =
          true;
      }
    };

  const clearPointerTap =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      pointerTap.id =
        null;
    };

  const onPointerUp =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      const duration =
        performance.now()
        - pointerTap.startedAt;

      const isTap =
        !pointerTap.moved
        && duration <= 700;

      pointerTap.id =
        null;

      if (!isTap) {
        return;
      }

      selectNearPosition(
        canvasPositionFromPointer(
          event
        ),
        {
          width:
            event.pointerType
            === "touch"
              ? 42
              : 28,

          height:
            event.pointerType
            === "touch"
              ? 42
              : 28
        }
      );
    };

  window.addEventListener(
    "pointerdown",
    onPointerDown,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointermove",
    onPointerMove,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointerup",
    onPointerUp,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointercancel",
    clearPointerTap,
    {
      capture:
        true,
      passive:
        true
    }
  );

  const clickFallback =
    typeof PointerEvent
      === "undefined"
      ? new CesiumRef
          .ScreenSpaceEventHandler(
            canvas
          )
      : null;

  clickFallback
    ?.setInputAction(
      movement => {
        selectNearPosition(
          movement.position,
          {
            width:
              32,
            height:
              32
          }
        );
      },
      CesiumRef
        .ScreenSpaceEventType
        .LEFT_CLICK
    );

  const hoverHandler =
    new CesiumRef
      .ScreenSpaceEventHandler(
        canvas
      );

  // Diagnostic preview: Cesium drillPick on every mouse movement can trigger
  // a synchronous WebGL pick render while weather imagery is being retired.
  // Keep outage click inspection intact, but disable GPU-backed hover picking
  // on the isolated radar-history-fix preview until texture lifecycle is proven.
  const suppressHoverGpuPicking =
    ["/preview/radar-history-fix/", "/preview/next-baseline/", "/preview/incremental-3d/"].some(
      path=>globalThis.location?.pathname?.includes(path)===true) ||
      (/\/live3d-operational-v9\.html$/.test(
        String(globalThis.location?.pathname??"")) &&
        !String(globalThis.location?.pathname??"").includes("/preview/"));
  if (!suppressHoverGpuPicking) {
    let lastHoverPickAt = 0;
    hoverHandler.setInputAction(movement => {
      const now = performance.now();
      if (now - lastHoverPickAt < 160) return;
      lastHoverPickAt = now;
      const outageId = outageIdNearPosition({
        viewer, position: movement.endPosition, width: 18, height: 18
      });
      canvas.style.cursor = outageId ? "pointer" : "";
    }, CesiumRef.ScreenSpaceEventType.MOUSE_MOVE);
  }

  checkbox
    ?.addEventListener(
      "change",
      event => {
        layer.setVisible(
          event.target.checked
        );

        if (
          !event.target
            .checked
        ) {
          showPowerOutageInfo(
            null
          );

          setPowerStatus({
            kind:
              "normal",
            message:
              "Power outages hidden"
          });
        }
      }
    );

  $("refreshPowerOutagesButton")
    ?.addEventListener(
      "click",
      () => {
        layer.refresh({
          force:
            true
        }).catch(
          () => {}
        );
      }
    );

  $("closePowerOutageInfo")
    ?.addEventListener(
      "click",
      () => {
        showPowerOutageInfo(
          null
        );
      }
    );

  window.addEventListener(
    "pagehide",
    () => {
      layer.stop();
      explorer.destroy();

      window.removeEventListener(
        "pointerdown",
        onPointerDown,
        true
      );

      window.removeEventListener(
        "pointermove",
        onPointerMove,
        true
      );

      window.removeEventListener(
        "pointerup",
        onPointerUp,
        true
      );

      window.removeEventListener(
        "pointercancel",
        clearPointerTap,
        true
      );

      if (
        clickFallback
        && !clickFallback
          .isDestroyed()
      ) {
        clickFallback
          .destroy();
      }

      if (
        !hoverHandler
          .isDestroyed()
      ) {
        hoverHandler
          .destroy();
      }
    },
    {
      once:
        true
    }
  );

  layer.start();

  return layer;
}
