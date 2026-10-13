import { api } from "@/lib/auth";
import { searchAll } from "@/lib/tasks";

export const GET = api(async (req) => {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return { tasks: [], messages: [] };
  return searchAll(q);
});
