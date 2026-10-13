import { api } from "@/lib/auth";
import { dashboardStats, sourcesOverview } from "@/lib/tasks";
import { autoDailyBackup } from "@/lib/backup";

export const GET = api(async () => {
  try {
    autoDailyBackup();
  } catch (e) {
    console.error("[auto-backup]", e);
  }
  return { stats: dashboardStats(), sources: sourcesOverview() };
});
