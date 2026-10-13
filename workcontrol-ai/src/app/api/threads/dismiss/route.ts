import { api, readJson } from "@/lib/auth";
import { dismissThread } from "@/lib/tasks";

export const POST = api(async (req) => {
  const { key } = await readJson<{ key: string }>(req);
  if (!key) throw new Error("Не указана переписка");
  dismissThread(key);
  return { ok: true };
});
