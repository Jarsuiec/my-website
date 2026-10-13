import { api } from "@/lib/auth";
import { saveSnapshot } from "@/lib/backup";
import { logActivity } from "@/lib/db";

export const POST = api(async () => {
  const name = saveSnapshot("manual");
  logActivity(null, "snapshot", `Архив сохранён на сервере: ${name}`);
  return { name };
});
