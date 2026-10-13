// Запуск production-сервера с безопасными настройками по умолчанию.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || "3000";
process.env.TZ ||= "Europe/Warsaw";

const localOnly = ["127.0.0.1", "localhost", "::1"].includes(host);
if (!localOnly && !process.env.APP_PASSWORD) {
  console.error(`\n[WorkControl] HOST=${host} открывает доступ из сети, но APP_PASSWORD не задан.\nЗадайте пароль в файле .env или используйте HOST=127.0.0.1.\n`);
  process.exit(1);
}
if (!fs.existsSync(".next/BUILD_ID")) {
  console.error("\n[WorkControl] Приложение ещё не собрано. Выполните: npm run build\n");
  process.exit(1);
}

console.log(`\n[WorkControl] Запуск: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
console.log(`[WorkControl] Данные: ${path.resolve(process.env.DATA_DIR || "./data")}`);
console.log(`[WorkControl] Пароль: ${process.env.APP_PASSWORD ? "включён" : "выключен (доступ только с этого компьютера)"}\n`);

const child = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-H", host, "-p", port], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
