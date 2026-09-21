import { redirect } from "next/navigation";

/** There is one network; /dashboard itself has nothing of its own to show. */
export default function DashboardPage() {
  redirect("/dashboard/connections");
}
