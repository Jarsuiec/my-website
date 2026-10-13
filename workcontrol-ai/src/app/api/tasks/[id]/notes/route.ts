import { api, readJson } from "@/lib/auth";
import { addNote } from "@/lib/tasks";

export const POST = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = Number((await ctx.params).id);
  const body = await readJson<{ body: string }>(req);
  addNote(id, String(body.body ?? ""));
  return { ok: true };
});
