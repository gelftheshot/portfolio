import { adminSessionHandlers } from "@/lib/server/admin-auth";
import { whenAdminConfigured } from "../_lib/when-configured.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = whenAdminConfigured(adminSessionHandlers.GET);
export const POST = whenAdminConfigured(adminSessionHandlers.POST);
export const DELETE = whenAdminConfigured(adminSessionHandlers.DELETE);
