import assert from "node:assert/strict";

import {
  parseEssentialEnergyKml
} from "../src/context-layers/essential-energy-kml-v1.js";

import {
  filterFeaturesToQueensland,
  representativePointForFeature
} from "../src/context-layers/queensland-mainland-filter-v1.js";

import {
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  ERGON_OUTAGE_AREA_QUERY_URL,
  DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,
  filterCurrentPowerOutages,
  isCurrentPowerOutage,
  loadPowerOutages,
  powerOutageSummary,
  powerOutageProviderCounts,
  styleTerrainClampedPowerOutagePolygon
} from "../src/context-layers/power-outages-v1.js";

// The warning "Entity geometry outlines are unsupported on terrain" must
// never be triggered by outage-area polygon styling. Keep real terrain and
// the original translucent fill; do not disable point-marker outlines.
const currentPolygon={outline:true,outlineColor:"legacy"};
const simulatedUnplannedColour={withAlpha:alpha=>({name:"unplanned",alpha})};
assert.equal(styleTerrainClampedPowerOutagePolygon(currentPolygon,simulatedUnplannedColour),true);
assert.equal(currentPolygon.outline,false);
assert.deepEqual(currentPolygon.material,{name:"unplanned",alpha:0.46});
assert.equal(currentPolygon.show,true);
assert.equal(currentPolygon.fill,true);
assert.equal(currentPolygon.zIndex,25);
assert.equal(currentPolygon.outlineColor,"legacy",
  "Unneeded polygon outline colour can remain without enabling outline geometry");
assert.equal(styleTerrainClampedPowerOutagePolygon(null,simulatedUnplannedColour),false);

const now =
  Date.parse(
    "2026-10-08T05:00:00+10:00"
  );

function polygon() {
  return {
    type:
      "Polygon",
    coordinates: [[
      [153.20, -27.80],
      [153.21, -27.80],
      [153.21, -27.81],
      [153.20, -27.80]
    ]]
  };
}

function outage({
  eventId,
  type = "UNPLANNED",
  status = "In Progress",
  customers = 125,
  suburbs = "ORMEAU",
  start = now - 30 * 60 * 1000,
  finish = null,
  provider
}) {
  return {
    type:
      "Feature",

    properties: {
      EVENT_ID:
        eventId,

      TYPE:
        type,

      STATUS:
        status,

      CUSTOMERS_AFFECTED:
        customers,

      SUBURBS:
        suburbs,

      STREETS:
        "Example Rd",

      START:
        start,

      FINISH:
        finish,

      EST_FIX_TIME:
        now + 45 * 60 * 1000,

      REASON:
        "Emergency Repairs",

      EXTRACTED:
        now - 2 * 60 * 1000,

      ...(
        provider
          ? {
              STORMTRACKER_PROVIDER:
                provider
            }
          : {}
      )
    },

    geometry:
      polygon()
  };
}

const active =
  outage({
    eventId:
      "INC-100"
  });

const future =
  outage({
    eventId:
      "PLAN-200",
    type:
      "PLANNED",
    status:
      "Scheduled",
    start:
      now + 60 * 60 * 1000
  });

const activePlanned =
  outage({
    eventId:
      "PLAN-ACTIVE",
    type:
      "PLANNED",
    status:
      "In Progress"
  });

const unknownType =
  outage({
    eventId:
      "UNKNOWN-FAULT",
    type:
      "UNKNOWN"
  });

const finished =
  outage({
    eventId:
      "INC-300",
    finish:
      now - 60 * 1000
  });

const cancelled =
  outage({
    eventId:
      "PLAN-400",
    status:
      "Cancelled"
  });

assert.equal(
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  15 * 60 * 1000
);

assert.match(
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  /VwEnergexOutages\/FeatureServer\/0\/query/
);

assert.match(
  ERGON_OUTAGE_AREA_QUERY_URL,
  /VwErgonOutages\/FeatureServer\/0\/query/
);

assert.match(
  DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,
  /essential-energy-outages$/
);

for (
  const url
  of [
    ENERGEX_OUTAGE_AREA_QUERY_URL,
    ERGON_OUTAGE_AREA_QUERY_URL
  ]
) {
  assert.match(
    url,
    /outSR=4326/
  );

  assert.match(
    url,
    /f=geojson/
  );
}

assert.equal(
  isCurrentPowerOutage(
    active,
    now
  ),
  true
);

assert.equal(
  isCurrentPowerOutage(
    future,
    now
  ),
  false
);

assert.equal(
  isCurrentPowerOutage(
    finished,
    now
  ),
  false
);

assert.equal(
  isCurrentPowerOutage(
    cancelled,
    now
  ),
  false
);

assert.equal(
  isCurrentPowerOutage(activePlanned, now),
  false,
  "Even currently running planned maintenance must be excluded."
);

assert.equal(
  isCurrentPowerOutage(unknownType, now),
  false,
  "Unclassified incidents must not be assumed unplanned."
);

const filtered =
  filterCurrentPowerOutages(
    {
      type:
        "FeatureCollection",

      features: [
        active,
        future,
        activePlanned,
        unknownType,
        finished,
        cancelled,
        {
          type:
            "Feature",

          properties: {
            EVENT_ID:
              "NO-GEOMETRY"
          },

          geometry:
            null
        }
      ]
    },
    now
  );

assert.equal(
  filtered.features.length,
  1
);

const energexSummary =
  powerOutageSummary({
    ...active,
    id:
      "energex:INC-100",

    properties: {
      ...active.properties,
      STORMTRACKER_PROVIDER:
        "Energex"
    }
  });

assert.deepEqual(
  energexSummary,
  {
    id:
      "energex:INC-100",

    eventId:
      "INC-100",

    provider:
      "Energex",

    attribution:
      "Energex | Energy Queensland",

    type:
      "UNPLANNED",

    status:
      "In Progress",

    customersAffected:
      125,

    suburbs:
      "ORMEAU",

    streets:
      "Example Rd",

    start:
      now - 30 * 60 * 1000,

    finish:
      "",

    estimatedFix:
      now + 45 * 60 * 1000,

    reason:
      "Emergency Repairs",

    extracted:
      now - 2 * 60 * 1000
  }
);

const ergonSummary =
  powerOutageSummary({
    ...active,
    id:
      "ergon:INC-100",

    properties: {
      ...active.properties,
      STORMTRACKER_PROVIDER:
        "Ergon"
    }
  });

assert.equal(
  ergonSummary.provider,
  "Ergon"
);

assert.equal(
  ergonSummary.attribution,
  "Ergon Energy | Energy Queensland"
);

assert.equal(
  ergonSummary.id,
  "ergon:INC-100"
);

const energexPayload = {
  type:
    "FeatureCollection",

  features: [
    outage({
      eventId:
        "SAME-ID",
      customers:
        10,
      suburbs:
        "BRISBANE"
    }),
    outage({
      eventId:
        "PLAN-PROVIDER-1",
      type:
        "PLANNED",
      status:
        "In Progress",
      customers:
        800
    })
  ]
};

const ergonPayload = {
  type:
    "FeatureCollection",

  features: [
    outage({
      eventId:
        "SAME-ID",
      customers:
        20,
      suburbs:
        "TOOWOOMBA"
    }),
    outage({
      eventId:
        "PLAN-PROVIDER-2",
      type:
        "PLANNED",
      status:
        "In Progress",
      customers:
        900
    })
  ]
};


const essentialKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark id="INCD-ESS-QLD">
    <Snippet><![CDATA[INCD-ESS-QLD]]></Snippet>
    <styleUrl>#sw_1249554_normal_unplanned</styleUrl>
    <description><![CDATA[
      <h2>INCD-ESS-QLD</h2>
      <div><span>Time Off:</span>08/10/2026 04:30:00</div>
      <div><span>Est. Time On:</span>08/10/2026 07:30:00</div>
      <div><span>No. of Customers affected:</span>30</div>
      <div><span>Reason:</span>We are investigating</div>
      <div><span>Last Updated:</span>08/10/2026 04:45:00</div>
    ]]></description>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        150.30,-28.56,0 150.32,-28.56,0 150.32,-28.54,0 150.30,-28.54,0 150.30,-28.56,0
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>
  <Placemark id="PLAN-ESS-QLD">
    <styleUrl>#sw_1249554_normal_planned</styleUrl>
    <description><![CDATA[
      <h2>PLAN-ESS-QLD</h2>
      <div><span>Time Off:</span>08/10/2026 04:30:00</div>
      <div><span>Est. Time On:</span>08/10/2026 07:30:00</div>
    ]]></description>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      150.30,-28.56,0 150.32,-28.56,0 150.32,-28.54,0 150.30,-28.54,0 150.30,-28.56,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
  <Placemark id="INCD-ESS-NSW">
    <Snippet><![CDATA[INCD-ESS-NSW]]></Snippet>
    <styleUrl>#sw_1249554_normal_unplanned</styleUrl>
    <description><![CDATA[
      <h2>INCD-ESS-NSW</h2>
      <div><span>Time Off:</span>08/10/2026 04:30:00</div>
      <div><span>Est. Time On:</span>08/10/2026 07:30:00</div>
      <div><span>No. of Customers affected:</span>99</div>
      <div><span>Reason:</span>We are investigating</div>
      <div><span>Last Updated:</span>08/10/2026 04:45:00</div>
    ]]></description>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        153.26,-28.82,0 153.28,-28.82,0 153.28,-28.80,0 153.26,-28.80,0 153.26,-28.82,0
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>
</Document>
</kml>`;

const queenslandBoundary = {
  type:
    "FeatureCollection",

  features: [
    {
      type:
        "Feature",

      properties: {
        OBJECTID:
          1
      },

      geometry: {
        type:
          "Polygon",

        coordinates: [[
          [140.0, -29.0],
          [151.0, -29.0],
          [153.6, -28.1],
          [153.6, -10.0],
          [140.0, -10.0],
          [140.0, -29.0]
        ]]
      }
    }
  ]
};

const parsedEssentialForBoundaryTest =
  parseEssentialEnergyKml(
    essentialKml
  );

assert.equal(
  parsedEssentialForBoundaryTest
    .features
    .length,
  3
);

const qldEssentialForBoundaryTest =
  parsedEssentialForBoundaryTest
    .features
    .find(
      feature =>
        feature.id
        === "essential:INCD-ESS-QLD"
    );

assert.deepEqual(
  representativePointForFeature(
    qldEssentialForBoundaryTest
  ).map(
    value =>
      Number(
        value.toFixed(
          4
        )
      )
  ),
  [
    150.31,
    -28.55
  ]
);

const directlyClippedEssential =
  filterFeaturesToQueensland(
    parsedEssentialForBoundaryTest,
    queenslandBoundary
  );

assert.deepEqual(
  directlyClippedEssential
    .features
    .map(
      feature =>
        feature.id
    ),
  [
    "essential:INCD-ESS-QLD",
    "essential:PLAN-ESS-QLD"
  ]
);

function okResponse(
  payload
) {
  return {
    ok:
      true,

    status:
      200,

    async json() {
      return payload;
    },

    async text() {
      return String(
        payload
      );
    }
  };
}

function textResponse(
  text
) {
  return {
    ok:
      true,

    status:
      200,

    async text() {
      return text;
    }
  };
}

const merged =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
            "VwErgonOutages"
          )
        ) {
          return okResponse(
            ergonPayload
          );
        }

        if (
          target.includes(
            "essential-energy-outages"
          )
        ) {
          return textResponse(
            essentialKml
          );
        }

        if (
          target.includes(
            "Locality/FeatureServer/5/query"
          )
        ) {
          return okResponse(
            queenslandBoundary
          );
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  merged.providers,
  [
    "Energex",
    "Ergon",
    "Essential Energy"
  ]
);

assert.equal(
  merged.partial,
  false
);

assert.equal(
  merged.payload
    .features
    .length,
  3
);

assert.deepEqual(
  merged.payload
    .features
    .map(
      feature =>
        feature.id
    )
    .sort(),
  [
    "energex:SAME-ID",
    "ergon:SAME-ID",
    "essential:INCD-ESS-QLD"
  ]
);

assert.deepEqual(
  merged.payload
    .features
    .map(
      powerOutageSummary
    )
    .map(
      summary =>
        summary.provider
    )
    .sort(),
  [
    "Energex",
    "Ergon",
    "Essential Energy"
  ]
);

const essentialFeature =
  merged.payload
    .features
    .find(
      feature =>
        feature.id
        === "essential:INCD-ESS-QLD"
    );

assert.equal(
  essentialFeature
    ?.properties
    ?.START,
  "2026-10-08T04:30:00+11:00",
  "Essential Energy source timestamps retain the provider clock before display conversion to Queensland time."
);

const partial =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
            "VwErgonOutages"
          )
        ) {
          return {
            ok:
              false,
            status:
              503
          };
        }

        if (
          target.includes(
            "essential-energy-outages"
          )
        ) {
          return textResponse(
            essentialKml
          );
        }

        if (
          target.includes(
            "Locality/FeatureServer/5/query"
          )
        ) {
          return okResponse(
            queenslandBoundary
          );
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  partial.providers,
  [
    "Energex",
    "Essential Energy"
  ]
);

assert.equal(
  partial.partial,
  true
);

assert.equal(
  partial.failedProviders
    .length,
  1
);

assert.equal(
  partial.failedProviders[0]
    .provider,
  "Ergon"
);

assert.equal(
  partial.payload
    .features
    .length,
  2
);

const boundaryFailure =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
            "VwErgonOutages"
          )
        ) {
          return okResponse(
            ergonPayload
          );
        }

        if (
          target.includes(
            "essential-energy-outages"
          )
        ) {
          return textResponse(
            essentialKml
          );
        }

        if (
          target.includes(
            "Locality/FeatureServer/5/query"
          )
        ) {
          return {
            ok:
              false,
            status:
              503
          };
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  boundaryFailure.providers,
  [
    "Energex",
    "Ergon"
  ],
  "Boundary failure must fail Essential Energy closed without affecting Queensland distributors."
);

assert.equal(
  boundaryFailure.partial,
  true
);

assert.equal(
  boundaryFailure.failedProviders
    .length,
  1
);

assert.equal(
  boundaryFailure.failedProviders[0]
    .provider,
  "Essential Energy"
);

assert.match(
  boundaryFailure.failedProviders[0]
    .message,
  /Queensland boundary HTTP 503/
);

assert.equal(
  boundaryFailure.payload
    .features
    .some(
      feature =>
        String(
          feature.id
        ).startsWith(
          "essential:"
        )
    ),
  false
);

await assert.rejects(
  () =>
    loadPowerOutages({
      nowMs:
        now,

      fetchImpl:
        async () => ({
          ok:
            false,
          status:
            503
        })
    }),
  /Energex.*outage feed HTTP 503.*Ergon.*outage feed HTTP 503.*Essential Energy outage feed HTTP 503/
);

// Reconciliation: count distinct emergency INCIDENTS, not polygon parts,
// customers or repeated suburbs, and never count closed/restored cases.
for(const finishedStatus of ["RESTORED","Resolved","Closed","Inactive","Withdrawn"]){
  assert.equal(isCurrentPowerOutage(outage({
    eventId:"CLOSED-"+finishedStatus,status:finishedStatus
  }),now),false,finishedStatus+" must not inflate emergency totals");
}
const summaryByProvider=powerOutageProviderCounts(merged.reportFeatures,{
  availableProviders:merged.providers,failedProviders:merged.failedProviders
});
assert.equal(summaryByProvider.total.outages,3);
assert.equal(summaryByProvider.total.customers,60);
assert.deepEqual(summaryByProvider.rows.map(row=>row.outages),[1,1,1]);
assert.deepEqual(summaryByProvider.rows.map(row=>row.customers),[10,20,30]);
assert.equal(powerOutageProviderCounts([
  ...merged.reportFeatures,...merged.reportFeatures,
  {...merged.reportFeatures[0],id:"energex:SAME-ID",geometry:null}
]).total.outages,3,"Source area, point and shared council must not inflate totals");

// Geometry is required for the MAP, but NOT to count a genuine provider
// incident in the statewide report, provider report or pending-location list.
const unmapped=outage({
  eventId:"QLD-NO-GEOMETRY",customers:37,suburbs:"BUNDABERG"
});
unmapped.geometry=null;
const unlocatedSource=await loadPowerOutages({
  nowMs:now,
  fetchImpl:async url=>{
    const target=String(url);
    if(target.includes("VwErgonOutages"))return okResponse(ergonPayload);
    if(target.includes("essential-energy-outages"))return textResponse(essentialKml);
    if(target.includes("Locality/FeatureServer/5/query"))
      return okResponse(queenslandBoundary);
    return okResponse({type:"FeatureCollection",
      features:[...energexPayload.features,unmapped]});
  }
});
assert.equal(unlocatedSource.payload.features.length,3,
  "No synthetic map geometry for a source outage without coordinates");
assert.equal(unlocatedSource.reportFeatures.length,4,
  "Statewide records include source-confirmed but unplottable QLD outages");
const unlocatedReport=powerOutageProviderCounts(unlocatedSource.reportFeatures,{
  availableProviders:unlocatedSource.providers,
  failedProviders:unlocatedSource.failedProviders
});
assert.equal(unlocatedReport.total.outages,4);
assert.equal(unlocatedReport.total.customers,97);
assert.equal(unlocatedReport.total.withoutGeometry,1);
assert.deepEqual(unlocatedReport.rows.map(r=>r.outages),[2,1,1]);

const partialReport=powerOutageProviderCounts(partial.reportFeatures,{
  availableProviders:partial.providers,failedProviders:partial.failedProviders
});
assert.deepEqual(partialReport.rows.map(row=>row.state),
  ["ok","unavailable","ok"]);
assert.equal(partialReport.total.outages,2);
assert.equal(partialReport.partial,true,
  "An unavailable provider makes the statewide figure a PARTIAL subtotal");

console.log(
  "Power outage checks passed: no planned/unknown events from Energex, Ergon or Essential Energy, Queensland-only Essential Energy keeps Goondiwindi, provider-qualified IDs, partial feeds and 15-minute refresh."
);
