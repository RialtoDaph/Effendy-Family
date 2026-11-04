// Runs one tool for the realtime model, as the signed-in person.

import { runTool } from "@/lib/assistant-tools";
import { authorize } from "@/lib/server-auth";

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const body = (await req.json().catch(() => null)) as { name?: string; arguments?: string } | null;

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(body?.arguments || "{}");
  } catch {
    return Response.json({ output: { error: "Arguments were not valid JSON." } });
  }
  return Response.json(await runTool(auth.sb, auth.userId, String(body?.name), args));
}
