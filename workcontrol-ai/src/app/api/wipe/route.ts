import { api, readJson } from "@/lib/auth";
import { wipeAll } from "@/lib/backup";

export const POST = api(async (req) => {
  const { confirm } = await readJson<{ confirm: string }>(req);
  if (confirm !== "УДАЛИТЬ") throw new Error("Для подтверждения введите слово УДАЛИТЬ");
  wipeAll();
  return { ok: true };
});
