import { assertAdminRequest, AdminAuthError } from "../../../../lib/server/admin-auth.js";
import { createAdminContentHandlers } from "../../../../lib/server/admin-github.js";
import { whenAdminConfigured } from "../_lib/when-configured.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handlers = createAdminContentHandlers({ assertRequest: assertAdminRequest, authErrorClass: AdminAuthError });
export const GET = whenAdminConfigured(handlers.GET);
export const PUT = whenAdminConfigured(handlers.PUT);
