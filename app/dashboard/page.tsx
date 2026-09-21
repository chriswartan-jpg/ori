import { redirect } from "next/navigation";

/** Business is the entry network; /dashboard itself has nothing of its own to show. */
export default function DashboardPage() {
  redirect("/dashboard/business");
}
