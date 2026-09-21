/**
 * The three mindmaps. Plain links, so this works in a Server Component and the browser
 * back button behaves. The active segment is set apart by border and text color, never
 * by a fill.
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
    <nav aria-label="Netzwerk" className="flex">
      {NETWORKS.map((network) => {
        const current = network === active;
        return (
          <Link
            key={network}
            href={`/dashboard/${network}`}
            aria-current={current ? "page" : undefined}
            className={`-ml-px flex items-baseline gap-2 border px-4 py-2 first:ml-0 first:rounded-l-md last:rounded-r-md ${
              current
                ? "relative border-foreground text-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            <span className="text-sm">{NETWORK_LABELS[network]}</span>
            <span className="label-mono">{counts[network]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
