import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

let _handler: ReturnType<typeof toNextJsHandler> | null = null;
function handler() {
  if (!_handler) _handler = toNextJsHandler(auth());
  return _handler;
}

export async function GET(req: Request) {
  try {
    return await handler().GET(req);
  } catch (error) {
    console.error("[Auth GET Error]", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: Request) {
  try {
    return await handler().POST(req);
  } catch (error) {
    console.error("[Auth POST Error]", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
