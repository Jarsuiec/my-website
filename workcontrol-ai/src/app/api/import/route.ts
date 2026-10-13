import { api, HttpError } from "@/lib/auth";
import { parseFile, parsePlainText, isWhatsApp, parseWhatsApp, MAX_FILE_BYTES, type ParseResult } from "@/lib/parsers";
import { ingest, myWhatsAppNames, type ImportSummary } from "@/lib/ingest";

export const POST = api(async (req) => {
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Некорректные данные формы");
  });
  const source = String(form.get("source") || "auto");
  const results: ImportSummary[] = [];
  const names = myWhatsAppNames();

  const text = String(form.get("text") || "").trim();
  if (text) {
    if (text.length > 5_000_000) throw new HttpError(413, "Слишком большой текст");
    const parsed: ParseResult = isWhatsApp(text)
      ? { format: "whatsapp", messages: parseWhatsApp(text, String(form.get("textLabel") || "Вставленный чат"), names), tasks: [], errors: [] }
      : { format: "text", messages: [parsePlainText(text, String(form.get("textLabel") || ""))], tasks: [], errors: [] };
    results.push(ingest(parsed, { filename: "Вставленный текст", source }));
  }

  for (const f of form.getAll("files")) {
    if (typeof f === "string") continue;
    if (f.size > MAX_FILE_BYTES) {
      results.push({ importId: 0, filename: f.name, format: "", added: 0, duplicates: 0, tasksCreated: 0, tasksUpdated: 0, tasksReopened: 0, errors: ["Файл слишком большой"] });
      continue;
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const parsed = await parseFile(f.name, buf, { myWhatsAppNames: names });
    if (!parsed.messages.length && !parsed.tasks.length) {
      results.push({ importId: 0, filename: f.name, format: parsed.format, added: 0, duplicates: 0, tasksCreated: 0, tasksUpdated: 0, tasksReopened: 0, errors: parsed.errors.length ? parsed.errors : ["В файле не найдено сообщений"] });
      continue;
    }
    results.push(ingest(parsed, { filename: f.name, source }));
  }
  if (!results.length) throw new HttpError(400, "Добавьте файлы или вставьте текст");
  return { results };
});
