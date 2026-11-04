import assert from "node:assert/strict";

import {
  DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  joinRiverGaugeObservations,
  loadRiverGaugeOperationalSnapshot,
  normaliseRiverStationName,
  riverGaugeDisplayState
} from "../src/context-layers/river-gauge-observations-v1.js";

function gauge({
  id,
  bom,
  awrc,
  name,
  types =
    "water level gauge;"
}) {
  return {
    type:
      "Feature",

    id,

    properties: {
      bom_stn_num:
        bom,

      awrc_stateid:
        awrc,

      name,

      lat:
        -27.5,

      long:
        153.0,

      state:
        "QLD",

      location_types:
        types,

      forecast_site_classification:
        "Data location",

      basin:
        "Example Basin",

      agency:
        "BoM",

      featreal:
        "Real"
    },

    geometry: {
      type:
        "Point",

      coordinates: [
        153.0,
        -27.5
      ]
    }
  };
}

const gauges = {
  type:
    "FeatureCollection",

  features: [
    gauge({
      id:
        "bom:040123",
      bom:
        "040123",
      awrc:
        "QLD-1",
      name:
        "Nerang River at Carrara"
    }),

    gauge({
      id:
        "bom:540071",
      bom:
        "540071",
      awrc:
        "QLD-2",
      name:
        "Brisbane River at Example Tide",
      types:
        "water level gauge;tide gauge;"
    }),

    gauge({
      id:
        "awrc:QLD-3",
      bom:
        "",
      awrc:
        "QLD-3",
      name:
        "Unique Name Gauge"
    }),

    gauge({
      id:
        "bom:111111",
      bom:
        "111111",
      awrc:
        "QLD-4",
      name:
        "Duplicate Name"
    }),

    gauge({
      id:
        "bom:222222",
      bom:
        "222222",
      awrc:
        "QLD-5",
      name:
        "Duplicate Name"
    })
  ]
};

const bulletins = {
  partial:
    true,

  failed: [
    {
      product:
        "IDQ60296",
      message:
        "test failure"
    }
  ],

  products: [
    {
      product:
        "IDQ60285",

      observations: [
        {
          stationName:
            "Different bulletin label",
          stationId:
            "40123",
          heightMetres:
            0.58,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:16 am Tue",
          recentDataHref:
            "/recent?id=040123",
          sourceProduct:
            "IDQ60285"
        },

        {
          stationName:
            "Brisbane River at Example Tide",
          stationId:
            "540071",
          heightMetres:
            1.2,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:17 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60286"
        },

        {
          stationName:
            "Unique Name Gauge",
          stationId:
            "",
          heightMetres:
            2.1,
          tendency:
            "steady",
          floodClass:
            "minor",
          observedText:
            "10:18 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60290"
        },

        {
          stationName:
            "Duplicate Name",
          stationId:
            "",
          heightMetres:
            3.0,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:19 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60290"
        },

        {
          stationName:
            "No Matching Gauge",
          stationId:
            "",
          heightMetres:
            0.4,
          tendency:
            "falling",
          floodClass:
            "",
          observedText:
            "10:20 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60291"
        }
      ]
    }
  ]
};

assert.equal(
  normaliseRiverStationName(
    " Nerang-River & Carrara "
  ),
  "nerang river and carrara"
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      false,
    tendency:
      "rising"
  }),
  "rising"
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      true,
    tendency:
      "rising"
  }),
  "tidal-rise",
  "A tidal rise alone must not be treated as a flood signal."
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      true,
    tendency:
      "rising",
    floodClass:
      "minor"
  }),
  "minor",
  "A BoM flood class takes precedence even at a tidal gauge."
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      false,
    tendency:
      "falling",
    floodClass:
      "major"
  }),
  "major"
);

const joined =
  joinRiverGaugeObservations({
    gauges,
    bulletins
  });

assert.equal(
  joined.totalGaugeLocations,
  5
);

assert.equal(
  joined.totalObservations,
  5
);

assert.equal(
  joined.matchedCount,
  2
);

assert.equal(
  joined.payload
    .features
    .length,
  2
);

assert.equal(
  joined.unmatchedObservations
    .length,
  3,
  "Name-only bulletin observations must remain unmatched, even if unique."
);

assert.equal(
  joined.partialBulletins,
  true
);

assert.equal(
  joined.failedProducts[0]
    .product,
  "IDQ60296"
);

const carrara =
  joined.payload
    .features
    .find(
      feature =>
        feature.id
        === "bom:040123"
    );

assert.equal(
  carrara.properties
    .STORMTRACKER_DISPLAY_STATE,
  "rising"
);

assert.equal(
  carrara.properties
    .STORMTRACKER_HEIGHT_METRES,
  0.58
);

const tidal =
  joined.payload
    .features
    .find(
      feature =>
        feature.id
        === "bom:540071"
    );

assert.equal(
  tidal.properties
    .STORMTRACKER_DISPLAY_STATE,
  "tidal-rise"
);

assert.equal(
  tidal.properties
    .STORMTRACKER_TIDAL_CONTEXT,
  "Tidal site · rising may reflect normal tide"
);

// Critically, Mirani Township 533178 and similarly named Mirani 033152
// must never trade observations even if their names overlap.
const mirani=joinRiverGaugeObservations({
  gauges:{type:"FeatureCollection",features:[
    gauge({id:"bom:533178",bom:"533178",awrc:"",name:"Mirani Township"}),
    gauge({id:"bom:033152",bom:"033152",awrc:"",name:"Mirani"})
  ]},
  bulletins:{products:[{observations:[
    {stationId:"533178",stationName:"Mirani",heightMetres:12.2,
     tendency:"steady",floodClass:"minor",observedText:"10:15 am Tue",
     sourceProduct:"IDQ65393"},
    {stationId:"033152",stationName:"Mirani Township",heightMetres:9.1,
     tendency:"rising",floodClass:"below-minor",observedText:"10:15 am Tue",
     sourceProduct:"IDQ65393"},
    {stationId:"",stationName:"Mirani Township",heightMetres:99,
     tendency:"rising",floodClass:"major",observedText:"10:15 am Tue",
     sourceProduct:"IDQ65393"}
  ]}]}
});
assert.equal(mirani.matchedCount,2);
assert.equal(mirani.unmatchedObservations.length,1);
assert.equal(mirani.payload.features.find(x=>x.id==="bom:533178")
  .properties.STORMTRACKER_HEIGHT_METRES,12.2);
assert.equal(mirani.payload.features.find(x=>x.id==="bom:033152")
  .properties.STORMTRACKER_HEIGHT_METRES,9.1);

assert.match(
  DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
  /river-gauge-metadata$/
);

assert.match(
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  /river-height-bulletins$/
);

let gaugeRequested = false;
let relayRequested = false;

const loaded =
  await loadRiverGaugeOperationalSnapshot({
    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes("qld-bom-river-station-locations-v1.json")
        ) {
          gaugeRequested =
            true;

          return {
            ok:
              true,
            status:
              200,
            async json() {
              return gauges;
            }
          };
        }

        if (
          target.includes(
            "river-height-bulletins"
          )
        ) {
          relayRequested =
            true;

          return {
            ok:
              true,
            status:
              200,
            async json() {
              return bulletins;
            }
          };
        }

        throw new Error(
          `Unexpected request ${target}`
        );
      }
  });

assert.equal(
  gaugeRequested,
  true
);

assert.equal(
  relayRequested,
  true
);

assert.equal(
  loaded.matchedCount,
  2
);

assert.equal(
  loaded.transport,
  "Verified BoM Queensland station catalogue + live BoM river-height relay"
);
let forcedCount=0;
const forced=await loadRiverGaugeOperationalSnapshot({
  force:true,
  fetchImpl:async (url,options)=>{
    const target=String(url);
    if(target.includes("river-height-bulletins")){
      forcedCount++;
      assert.match(target,/\?force=1&_ts=\d+/,
        "Manual refresh must explicitly request a fresh relay snapshot");
      assert.equal(options.cache,"no-store");
      return {ok:true,json:async()=>bulletins};
    }
    if(target.includes("qld-bom-river-station-locations-v1.json"))
      return {ok:true,json:async()=>gauges};
    throw Error("Unexpected force fetch "+target);
  }
});
assert.equal(forcedCount,1);
assert.equal(forced.matchedCount,2);


console.log(
  "River gauge operational checks passed: strict station-ID joins, no guessed names or swapped Mirani observations, BoM flood-class precedence and tidal-rise suppression."
);

 
// Multiple BoM products with the same Warilda station must not revert
// the most recent moderate height back to an older minor classification.
const warildaGeo={type:"FeatureCollection",features:[
  gauge({id:"bom:544058",bom:"544058",awrc:"",name:"Warilda ALERT"})
]};
const reading=(height,time,flood)=>({
  stationId:"544058",stationName:"Warilda ALERT",heightMetres:height,
  tendency:"rising",floodClass:flood,observedText:time,sourceProduct:"IDQ60289"
});
for(const products of [
  [{observations:[reading(3.5,"09.25PM Mon","minor")]},
   {observations:[reading(4.25,"10.25PM Mon","moderate")]}],
  [{observations:[reading(4.25,"10.25PM Mon","moderate")]},
   {observations:[reading(3.5,"09.25PM Mon","minor")]}]
]){
  const x=joinRiverGaugeObservations({
    gauges:warildaGeo,bulletins:{products},nowMs:Date.UTC(2026,9,19,13,36)});
  assert.equal(x.payload.features[0].properties.STORMTRACKER_HEIGHT_METRES,4.25);
  assert.equal(x.payload.features[0].properties.STORMTRACKER_FLOOD_CLASS,"moderate");
}
