import { api, readJson } from "@/lib/auth";
import { draftReply } from "@/lib/assistant";

export const POST = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = Number((await ctx.params).id);
  const body = await readJson<{ lang?: string }>(req);
  return draftReply(id, body.lang);
});
