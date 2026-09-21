import { redirect } from "next/navigation";

/**
 * There is no sign-in any more, so the landing page has nothing to gate, and there is
 * only one network to land on.
 */
export default function RootPage() {
  redirect("/dashboard/connections");
}
