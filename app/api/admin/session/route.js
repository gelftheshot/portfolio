import { adminSessionHandlers } from "@/lib/server/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminSessionHandlers.GET;
export const POST = adminSessionHandlers.POST;
export const DELETE = adminSessionHandlers.DELETE;
