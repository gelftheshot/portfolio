import { operationsHandlers } from "@/lib/server/admin-operations";
import { whenAdminConfigured } from "../_lib/when-configured.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = whenAdminConfigured(operationsHandlers.GET);
export const PUT = whenAdminConfigured(operationsHandlers.PUT);
