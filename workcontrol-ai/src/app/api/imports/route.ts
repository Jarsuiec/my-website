import { api } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sourcesOverview } from "@/lib/tasks";

export const GET = api(async () => {
  const imports = getDb().prepare("SELECT * FROM imports ORDER BY id DESC LIMIT 100").all();
  return { imports, sources: sourcesOverview() };
});
