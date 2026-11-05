import { assertAdminRequest, AdminAuthError } from "../../../../lib/server/admin-auth.js";
import { createAdminContentHandlers } from "../../../../lib/server/admin-github.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handlers = createAdminContentHandlers({ assertRequest: assertAdminRequest, authErrorClass: AdminAuthError });
export const GET = handlers.GET;
export const PUT = handlers.PUT;
