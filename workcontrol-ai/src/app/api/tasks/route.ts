import { api, readJson } from "@/lib/auth";
import { createTask, listTasks, type TaskFilter } from "@/lib/tasks";

export const GET = api(async (req) => {
  const u = new URL(req.url).searchParams;
  const f: TaskFilter = {
    view: (u.get("view") as TaskFilter["view"]) || "active",
    preset: u.get("preset") || undefined,
    source: u.get("source") || undefined,
    status: u.get("status") || undefined,
    priority: u.get("priority") || undefined,
    categories: u.get("categories") ? u.get("categories")!.split(",") : undefined,
    category: u.get("category") || undefined,
    q: u.get("q") || undefined,
    from: u.get("from") || undefined,
    to: u.get("to") || undefined,
    demo: (u.get("demo") as TaskFilter["demo"]) || undefined,
  };
  return { tasks: listTasks(f) };
});

export const POST = api(async (req) => {
  const body = await readJson(req);
  const id = createTask(body, { messageId: body.messageId ? Number(body.messageId) : undefined });
  return { id };
});
