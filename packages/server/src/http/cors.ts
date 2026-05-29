/**
 * CORS helpers for the hub HTTP surface.
 *
 * Browser-origin clients (the Next.js web UI, embedded dashboards, and any
 * future iframe panels) may talk to a hub on a different origin. The hub
 * surfaces three configuration knobs:
 *
 *   LECODER_HUB_CORS_ORIGINS  — comma-separated allowlist, or "*" to mirror
 *                              the request origin. Default: "*" (matches the
 *                              "lenient by default" stance of the rest of the
 *                              hub; tighten via env in production).
 *   LECODER_HUB_CORS_METHODS  — comma-separated method allowlist. Default:
 *                              GET,POST,PATCH,DELETE,OPTIONS.
 *   LECODER_HUB_CORS_HEADERS  — comma-separated header allowlist. Default:
 *                              Content-Type,Authorization.
 *
 * Echoing the origin back (instead of literal "*") is necessary because most
 * routes accept Authorization headers, and "*" + credentials is rejected by
 * the browser.
 */
const DEFAULT_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const DEFAULT_HEADERS = 'Content-Type,Authorization';

function configuredOrigins(): { mirror: boolean; allowlist: Set<string> } {
  const raw = process.env.LECODER_HUB_CORS_ORIGINS;
  if (!raw || raw.trim() === '*') {
    return { mirror: true, allowlist: new Set() };
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { mirror: false, allowlist: new Set(list) };
}

function configuredMethods(): string {
  return process.env.LECODER_HUB_CORS_METHODS?.trim() || DEFAULT_METHODS;
}

function configuredHeaders(): string {
  return process.env.LECODER_HUB_CORS_HEADERS?.trim() || DEFAULT_HEADERS;
}

/**
 * Determine the value of `Access-Control-Allow-Origin` for a given request.
 * Returns null when the origin is not allowed.
 */
export function resolveAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const { mirror, allowlist } = configuredOrigins();
  if (mirror) return origin;
  return allowlist.has(origin) ? origin : null;
}

/**
 * Build the standard set of CORS headers for a request. Returns an empty
 * Headers object when the request has no Origin (non-browser caller).
 */
export function buildCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const allowed = resolveAllowedOrigin(request);
  if (!allowed) return headers;

  headers.set('Access-Control-Allow-Origin', allowed);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', configuredMethods());
  headers.set('Access-Control-Allow-Headers', configuredHeaders());
  headers.set('Access-Control-Max-Age', '600');
  return headers;
}

/**
 * Handle a CORS preflight (OPTIONS) request. Returns null for non-CORS
 * preflights so the caller can fall through to its normal routing.
 */
export function handleCorsPreflight(request: Request): Response | null {
  if (!request.headers.get('Origin')) return null;
  if (!request.headers.get('Access-Control-Request-Method')) return null;
  return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
}

/**
 * Apply CORS headers to an outgoing response in-place. Returns the same
 * response (or a clone with merged headers) for ergonomic chaining.
 */
export function applyCorsHeaders(request: Request, response: Response): Response {
  const cors = buildCorsHeaders(request);
  if (cors.entries().next().done) return response;
  // Mutating Response.headers is allowed in Bun/Node 20+, but to be safe we
  // construct a new Response if the body has already been read. For typical
  // freshly-created Responses the in-place set works fine.
  try {
    cors.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch {
    const merged = new Headers(response.headers);
    cors.forEach((value, key) => merged.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  }
}
