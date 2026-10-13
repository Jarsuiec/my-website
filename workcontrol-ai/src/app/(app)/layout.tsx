import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { authEnabled, isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return <Shell authEnabled={authEnabled()}>{children}</Shell>;
}
