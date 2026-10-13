import { api } from "@/lib/auth";
import { listSnapshots } from "@/lib/backup";

export const GET = api(async () => ({ snapshots: listSnapshots() }));
