import { api, HttpError } from "@/lib/auth";
import { backupFilename, claudeContext, createBackup, createZip, messagesCsv, reportMarkdown, tasksCsv } from "@/lib/backup";
import { logActivity } from "@/lib/db";

function file(body: string | Buffer, name: string, type: string) {
  return new Response(new Uint8Array(typeof body === "string" ? Buffer.from(body, "utf8") : body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = api(async (req) => {
  const u = new URL(req.url).searchParams;
  const type = u.get("type");
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
  switch (type) {
    case "json":
      logActivity(null, "export", "Скачана резервная копия JSON");
      return file(JSON.stringify(createBackup(), null, 1), backupFilename("json"), "application/json; charset=utf-8");
    case "zip":
      logActivity(null, "export", "Скачана резервная копия ZIP");
      return file(await createZip(), backupFilename("zip"), "application/zip");
    case "tasks.csv":
      return file(tasksCsv(), `workcontrol-tasks-${stamp}.csv`, "text/csv; charset=utf-8");
    case "messages.csv":
      return file(messagesCsv(), `workcontrol-messages-${stamp}.csv`, "text/csv; charset=utf-8");
    case "report.md":
      return file(reportMarkdown(), `workcontrol-report-${stamp}.md`, "text/markdown; charset=utf-8");
    case "claude.md":
      return file(claudeContext({ maskPii: u.get("mask") === "1" }), `workcontrol-claude-context-${stamp}.md`, "text/markdown; charset=utf-8");
    case "report.preview":
      return { text: reportMarkdown() };
    case "claude.preview":
      return { text: claudeContext({ maskPii: u.get("mask") === "1" }) };
    default:
      throw new HttpError(400, "Неизвестный тип экспорта");
  }
});
