function decodeEntities(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&amp;",
      "&"
    )
    .replaceAll(
      "&lt;",
      "<"
    )
    .replaceAll(
      "&gt;",
      ">"
    )
    .replaceAll(
      "&quot;",
      '"'
    )
    .replaceAll(
      "&#39;",
      "'"
    )
    .replaceAll(
      "&nbsp;",
      " "
    );
}

function stripTags(
  value
) {
  return decodeEntities(
    String(
      value ?? ""
    )
      .replace(
        /<br\s*\/?\s*>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function normaliseHeading(
  value
) {
  return stripTags(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function normaliseTendency(
  value
) {
  const text =
    stripTags(
      value
    ).toLowerCase();

  if (
    text.includes(
      "rising"
    )
  ) {
    return "rising";
  }

  if (
    text.includes(
      "falling"
    )
  ) {
    return "falling";
  }

  if (
    text.includes(
      "steady"
    )
    || text.includes(
      "stationary"
    )
  ) {
    return "steady";
  }

  return "unknown";
}

function normaliseFloodClass(
  value
) {
  const text =
    stripTags(
      value
    ).toLowerCase();

  if (
    text.includes(
      "major"
    )
  ) {
    return "major";
  }

  if (
    text.includes(
      "moderate"
    )
  ) {
    return "moderate";
  }

  if (
    text.includes(
      "minor"
    )
    && !text.includes(
      "below"
    )
  ) {
    return "minor";
  }

  if (
    text.includes(
      "below"
    )
    && text.includes(
      "minor"
    )
  ) {
    return "below-minor";
  }

  return "";
}

function parseHeight(
  value
) {
  const match =
    stripTags(
      value
    ).match(
      /-?\d+(?:\.\d+)?/
    );

  if (!match) {
    return null;
  }

  const height =
    Number(
      match[0]
    );

  return Number.isFinite(
    height
  )
    ? height
    : null;
}

function tableRows(
  html
) {
  const rows = [];
  const regex =
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          String(
            html ?? ""
          )
        )
    )
  ) {
    const cells = [];
    const cellRegex =
      /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;

    let cellMatch;

    while (
      (
        cellMatch =
          cellRegex.exec(
            match[1]
          )
      )
    ) {
      cells.push(
        cellMatch[1]
      );
    }

    if (cells.length) {
      rows.push(
        cells
      );
    }
  }

  return rows;
}

function recentDataHref(
  cell
) {
  const match =
    String(
      cell ?? ""
    ).match(
      /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i
    );

  return match
    ? decodeEntities(
        match[1]
      ).trim()
    : "";
}

function stationIdFromHref(
  href
) {
  const text =
    String(
      href ?? ""
    );

  const candidates = [
    /\b(?:IDQ\d+)\.(\d{5,})\.plt(?:\.shtml)?\b/i,
    /\b(?:station|stn|site|id)=([A-Za-z0-9_-]+)/i,
    /\b(\d{5,})\b/,
    /\b([A-Z]{1,4}\d{4,})\b/
  ];

  for (
    const pattern
    of candidates
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      return match[1];
    }
  }

  return "";
}

function headerIndex(
  headers,
  names
) {
  return headers.findIndex(
    header =>
      names.some(
        name =>
          header.includes(
            name
          )
      )
  );
}

export function parseRiverHeightTable(
  html,
  sourceProduct = ""
) {
  const rows =
    tableRows(
      html
    );

  if (!rows.length) {
    return [];
  }

  const headerRowIndex =
    rows.findIndex(
      row => {
        const headers =
          row.map(
            normaliseHeading
          );

        return (
          headerIndex(
            headers,
            [
              "station name",
              "station"
            ]
          ) >= 0
          && headerIndex(
            headers,
            [
              "height"
            ]
          ) >= 0
          && headerIndex(
            headers,
            [
              "tendency",
              "trend"
            ]
          ) >= 0
        );
      }
    );

  if (
    headerRowIndex < 0
  ) {
    return [];
  }

  const headers =
    rows[
      headerRowIndex
    ].map(
      normaliseHeading
    );

  const stationIndex =
    headerIndex(
      headers,
      [
        "station name",
        "station"
      ]
    );

  // BoM identifies manual gauges in the actual current river-height table.
  // Keep this metadata tied to the exact BoM station row, not a name guess.
  const typeIndex = headers.findIndex(header =>
    header==="type" || header==="station type" || header==="gauge type");

  const timeIndex =
    headerIndex(
      headers,
      [
        "time day",
        "time",
        "observation time"
      ]
    );

  const heightIndex =
    headerIndex(
      headers,
      [
        "height"
      ]
    );

  const tendencyIndex =
    headerIndex(
      headers,
      [
        "tendency",
        "trend"
      ]
    );

  const floodIndex =
    headerIndex(
      headers,
      [
        "flood class",
        "flood classification"
      ]
    );

  const recentIndex =
    headerIndex(
      headers,
      [
        "recent data",
        "recent"
      ]
    );

  return rows
    .slice(
      headerRowIndex + 1
    )
    .map(
      row => {
        const stationName =
          stripTags(
            row[
              stationIndex
            ]
          );

        if (!stationName) {
          return null;
        }

        const heightMetres =
          parseHeight(
            row[
              heightIndex
            ]
          );

        if (
          heightMetres
          === null
        ) {
          return null;
        }

        const href =
          recentIndex >= 0
            ? recentDataHref(
                row[
                  recentIndex
                ]
              )
            : "";

        const reportingMode=typeIndex>=0
          ?stripTags(row[typeIndex]).toLowerCase().trim():"";

        return {
          stationName,

          // Only the literal source 'Manual' may extend the stale flood
          // evidence window; automatic/unknown gauges retain 24-hour expiry.
          ...(reportingMode==="manual"?{reportingMode:"manual"}:{}),

          stationId:
            stationIdFromHref(
              href
            ),

          heightMetres,

          tendency:
            normaliseTendency(
              row[
                tendencyIndex
              ]
            ),

          floodClass:
            floodIndex >= 0
              ? normaliseFloodClass(
                  row[
                    floodIndex
                  ]
                )
              : "",

          observedText:
            timeIndex >= 0
              ? stripTags(
                  row[
                    timeIndex
                  ]
                )
              : "",

          recentDataHref:
            href,

          sourceProduct:
            String(
              sourceProduct
              ?? ""
            ).trim()
        };
      }
    )
    .filter(Boolean);
}

function looksLikeRiverHeightLine(
  fields
) {
  return (
    fields.length >= 4
    && parseHeight(
      fields[1]
    ) !== null
    && normaliseTendency(
      fields[2]
    ) !== "unknown"
  );
}

export function parseRiverHeightText(
  text,
  sourceProduct = ""
) {
  return String(
    text ?? ""
  )
    .split(
      /\r?\n/
    )
    .map(
      line =>
        line.trim()
    )
    .filter(Boolean)
    .map(
      line =>
        line
          .split(",")
          .map(
            field =>
              field.trim()
          )
    )
    .filter(
      looksLikeRiverHeightLine
    )
    .map(
      fields => ({
        stationName:
          fields[0],

        stationId:
          "",

        heightMetres:
          parseHeight(
            fields[1]
          ),

        tendency:
          normaliseTendency(
            fields[2]
          ),

        floodClass:
          fields.length >= 5
            ? normaliseFloodClass(
                fields[4]
              )
            : "",

        observedText:
          fields[3],

        recentDataHref:
          "",

        sourceProduct:
          String(
            sourceProduct
            ?? ""
          ).trim()
      })
    );
}

export function parseRiverHeightBulletin({
  html = "",
  text = "",
  sourceProduct = ""
} = {}) {
  const table =
    parseRiverHeightTable(
      html,
      sourceProduct
    );

  if (table.length) {
    return table;
  }

  const fallbackText =
    text
    || stripTags(
      html
        .replace(
          /<br\s*\/?\s*>/gi,
          "\n"
        )
        .replace(
          /<\/(?:p|div|li|tr)>/gi,
          "\n"
        )
    );

  return parseRiverHeightText(
    fallbackText,
    sourceProduct
  );
}
