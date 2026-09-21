import { notFound, redirect } from "next/navigation";

import { signOut } from "@/lib/actions/auth";
import { networkCounts } from "@/lib/core/contacts";
import { getGraphData } from "@/lib/core/read";
import { isNetwork, todayIso } from "@/lib/core/types";
import { createClient } from "@/lib/supabase/server";
import NetworkSwitcher from "@/components/network-switcher";
import NetworkView from "@/components/network-view";
import { BTN_QUIET } from "@/components/primitives";

/**
 * The core screen. Reads the session (proxy.ts already gated it), loads one network's
 * graph projection plus the switcher counts, and hands both to the client view.
 *
 * `today` is computed here so server render and hydration agree on the date.
 */
export default async function NetworkPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetwork(network)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${network}`);

  const [contacts, counts] = await Promise.all([
    getGraphData(supabase, user.id, network),
    networkCounts(supabase, user.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="shrink-0 border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-6 py-4">
          <span className="font-mono text-sm tracking-[0.35em] text-foreground">ORI</span>
          <NetworkSwitcher active={network} counts={counts} />
          <form action={signOut} className="ml-auto">
            <button type="submit" className={BTN_QUIET}>
              Abmelden
            </button>
          </form>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <NetworkView network={network} contacts={contacts} today={todayIso()} />
      </main>
    </div>
  );
}
