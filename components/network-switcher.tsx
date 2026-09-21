/**
 * The network nav. There is one network now, so this is not a tab group any more: it names
 * the network you are in and carries its headcount as the first headline number in the
 * header. Plain links, so it works in a Server Component; aria-current marks the active one.
 */
import Link from "next/link";

import { NETWORKS, NETWORK_LABELS, type Network } from "@/lib/core/types";

export default function NetworkSwitcher({
  active,
  counts,
}: {
  active: Network;
  counts: Record<Network, number>;
}) {
  return (
    <nav aria-label="Network" className="flex items-center gap-3">
      {NETWORKS.map((network) => {
        const current = network === active;
        return (
          <Link
            key={network}
            href={`/dashboard/${network}`}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-3 rounded-full ${
              current ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-base font-medium">{NETWORK_LABELS[network]}</span>
            <span className="stat">
              <b>{counts[network]}</b>
              <span className="label-mono">contacts</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
