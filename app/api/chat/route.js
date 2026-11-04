import { createChatHandler } from "@/lib/server/chat-handler";
import { createChatAbuseGuard } from "@/lib/server/chat-abuse-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = createChatHandler({ rateLimit: createChatAbuseGuard() });
