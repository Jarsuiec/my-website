import { api } from "@/lib/auth";
import { listThreads } from "@/lib/tasks";

export const GET = api(async (req) => {
  const u = new URL(req.url).searchParams;
  const filter = u.get("filter");
  return {
    threads: listThreads({
      q: u.get("q") || undefined,
      source: u.get("source") || undefined,
      missedOnly: filter === "missed",
      unansweredOnly: filter === "unanswered",
      limit: 500,
    }),
  };
});
