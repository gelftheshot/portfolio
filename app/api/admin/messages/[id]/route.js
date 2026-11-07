import { messageStatusHandler } from "@/lib/server/admin-operations";
import { whenAdminConfigured } from "../../_lib/when-configured.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PATCH = whenAdminConfigured(messageStatusHandler);
