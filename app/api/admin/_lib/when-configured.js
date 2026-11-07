import { getAdminConfiguration } from "../../../../lib/server/admin-auth.js";

const isConfigured = () => getAdminConfiguration().configured === true;

/** The same bare 404 that Next.js returns for notFound() in a Route Handler,
 * marked uncacheable so it never outlives a later configuration change. */
export function adminNotFound() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** Until the admin credentials (and, in production, shared Redis) are configured,
 * admin endpoints answer like routes that do not exist instead of describing the
 * setup state. Once configured, the wrapped handler runs unchanged. */
export function whenAdminConfigured(handler, configured = isConfigured) {
  return (request, context) => (configured() ? handler(request, context) : adminNotFound());
}
