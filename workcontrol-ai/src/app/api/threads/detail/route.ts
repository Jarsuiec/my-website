import { api, HttpError } from "@/lib/auth";
import { getThread } from "@/lib/tasks";

export const GET = api(async (req) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) throw new HttpError(400, "Не указана переписка");
  const t = getThread(key);
  if (!t.messages.length) throw new HttpError(404, "Переписка не найдена");
  return t;
});
