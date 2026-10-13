import { api, HttpError } from "@/lib/auth";
import { readBackupFile, restoreBackup } from "@/lib/backup";

export const POST = api(async (req) => {
  const form = await req.formData();
  if (form.get("confirm") !== "yes") throw new HttpError(400, "Подтвердите замену данных");
  const f = form.get("file");
  if (!f || typeof f === "string") throw new HttpError(400, "Выберите файл резервной копии");
  const data = await readBackupFile(f.name, Buffer.from(await f.arrayBuffer()));
  const r = restoreBackup(data);
  return { ...r, backup_created_at: data.created_at };
});
