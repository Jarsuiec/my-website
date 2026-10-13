import { api, readJson } from "@/lib/auth";
import { applyAction, getTask, type StatusAction } from "@/lib/tasks";

export const POST = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = Number((await ctx.params).id);
  const body = await readJson<{ action: StatusAction; until?: string }>(req);
  applyAction(id, body.action, body.until);
  return { task: getTask(id)?.task };
});
