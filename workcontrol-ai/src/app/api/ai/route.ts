import { api, readJson } from "@/lib/auth";
import { aiStatus, ask } from "@/lib/assistant";

export const GET = api(async () => ({ status: aiStatus() }));

export const POST = api(async (req) => {
  const body = await readJson<{ question: string; history?: { role: "user" | "assistant"; content: string }[] }>(req);
  const history = (body.history || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  return ask(String(body.question || ""), history);
});
