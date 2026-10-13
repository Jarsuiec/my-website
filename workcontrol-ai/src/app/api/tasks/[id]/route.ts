import { api, HttpError, readJson } from "@/lib/auth";
import { getTask, updateTask } from "@/lib/tasks";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api(async (_req, ctx: Ctx) => {
  const d = getTask(Number((await ctx.params).id));
  if (!d) throw new HttpError(404, "Задача не найдена");
  return d;
});

export const PATCH = api(async (req, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  updateTask(id, await readJson(req));
  return getTask(id);
});
