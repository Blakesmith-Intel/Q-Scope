// Candidate-only Cloudflare preview. This script is NEVER imported by the
// approved production relay and exposes no extra mutation endpoints.
import acceptedRelay from "../relay/worker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    // Public reviewer access to static assets. Relay API requests must be
    // same-origin and read-only; keep the production relay's own validation.
    if (origin && origin !== url.origin) {
      return new Response("This QA relay is same-origin only", {status: 403});
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {status: 405});
    }
    if (url.pathname === "/__qscope-preview-health") {
      return new Response(
        JSON.stringify({
          release: "Q-SCOPE isolated BoM wind observations PR328",
          preview: true,
          productionUnmodified: true,
          source: "official BoM observation relay"
        }),
        {headers: {"Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"}}
      );
    }
    // Cloudflare serves real file assets first. All unmatched paths are the
    // candidate's original read-only BoM/data relay paths, same as production.
    // Strip the PREVIEW origin only; production-origin allowlists are untouched.
    const headers = new Headers(request.headers);
    headers.delete("Origin");
    return acceptedRelay.fetch(new Request(request, {headers}), env, ctx);
  }
};
