import { api, readJson } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { recomputeDirections } from "@/lib/ingest";
import { aiStatus } from "@/lib/assistant";
import { authEnabled } from "@/lib/auth";

const KEYS = ["my_addresses", "my_whatsapp_names", "ai_external_allowed", "ai_mask_pii"];

export const GET = api(async () => ({
  settings: Object.fromEntries(KEYS.map((k) => [k, getSetting(k, k === "ai_mask_pii" ? "1" : "")])),
  ai: aiStatus(),
  auth: authEnabled(),
  dataDir: process.env.DATA_DIR || "./data",
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
}));

export const POST = api(async (req) => {
  const body = await readJson<Record<string, string>>(req);
  const before = getSetting("my_addresses");
  for (const k of KEYS) if (k in body) setSetting(k, String(body[k] ?? "").slice(0, 5000));
  let recomputed = null;
  if ("my_addresses" in body && body.my_addresses !== before) recomputed = recomputeDirections();
  return { ok: true, recomputed };
});
