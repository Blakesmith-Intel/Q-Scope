import assert from "node:assert/strict";

import worker from "../../relay/worker.js";

const originalFetch =
  globalThis.fetch;

const metadataPayload = {
  type:
    "FeatureCollection",

  features: [
    {
      type:
        "Feature",

      properties: {
        bom_stn_num:
          "040123",

        awrc_stateid:
          "QLD-123",

        name:
          "Example River",

        lat:
          -27.50,

        long:
          153.10,

        state:
          "QLD",

        location_types:
          "water level gauge;",

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
          153.10,
          -27.50
        ]
      }
    }
  ]
};

// The relay now fail-closes incomplete statewide catalogues. Simulate a
// representative official BoM QLD response rather than a one-site fragment.
const representativeGauge=metadataPayload.features[0];
metadataPayload.features=Array.from({length:600},(_,index)=>({
  ...representativeGauge,
  properties:{
    ...representativeGauge.properties,
    bom_stn_num:String(40123+index).padStart(6,"0")
  }
}));

let requestedUrl = "";

globalThis.fetch =
  async url => {
    requestedUrl =
      String(url);

    return new Response(
      JSON.stringify(
        metadataPayload
      ),
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/geo+json"
        }
      }
    );
  };

try {
  const response =
    await worker.fetch(
      new Request(
        "https://relay.invalid/river-gauge-metadata",
        {
          headers: {
            Origin:
              "https://blakesmith-intel.github.io"
          }
        }
      ),
      {}
    );

  assert.equal(
    response.status,
    200
  );

  assert.equal(
    response.headers.get(
      "Access-Control-Allow-Origin"
    ),
    "https://blakesmith-intel.github.io"
  );

  assert.equal(
    response.headers.get(
      "Cross-Origin-Resource-Policy"
    ),
    "cross-origin"
  );

  assert.equal(
    response.headers.get(
      "Cache-Control"
    ),
    "public, max-age=300"
  );

  assert.match(
    requestedUrl,
    /National_Flood_Gauge_Network\/FeatureServer\/5\/query/
  );

  assert.match(
    requestedUrl,
    /state%3D%27QLD%27/
  );

  assert.deepEqual(
    await response.json(),
    metadataPayload
  );

  const head =
    await worker.fetch(
      new Request(
        "https://relay.invalid/river-gauge-metadata",
        {
          method:
            "HEAD",

          headers: {
            Origin:
              "https://blakesmith-intel.github.io"
          }
        }
      ),
      {}
    );

  assert.equal(
    head.status,
    200
  );

  assert.equal(
    await head.text(),
    ""
  );
} finally {
  globalThis.fetch =
    originalFetch;
}

console.log(
  "River-gauge metadata relay checks passed: BoM ArcGIS GeoJSON is proxied with GitHub Pages CORS and five-minute cache headers."
);
