import { api, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const GET = api(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const id = Number((await ctx.params).id);
  const row = getDb().prepare("SELECT id, thread_key FROM messages WHERE id = ?").get(id);
  if (!row) throw new HttpError(404, "Сообщение не найдено");
  return row;
});
