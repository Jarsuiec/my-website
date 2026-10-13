import fs from "node:fs";
import { api, HttpError } from "@/lib/auth";
import { snapshotPath } from "@/lib/backup";

export const GET = api(async (_req, ctx: { params: Promise<{ name: string }> }) => {
  const name = (await ctx.params).name;
  const p = snapshotPath(name);
  if (!p) throw new HttpError(404, "Файл не найден");
  return new Response(new Uint8Array(fs.readFileSync(p)), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
