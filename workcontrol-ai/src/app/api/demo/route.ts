import { api, readJson } from "@/lib/auth";
import { loadDemo, removeDemo } from "@/lib/demo";

export const POST = api(async (req) => {
  const { action } = await readJson<{ action: string }>(req);
  if (action === "load") return { result: loadDemo() };
  if (action === "remove") return { result: removeDemo() };
  throw new Error("Неизвестное действие");
});
