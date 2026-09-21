"use client";

/**
 * Chrome around one network: the header with the three numbers that matter (how many
 * contacts, how many have gone quiet, and what that silence is worth) plus the demo
 * controls.
 *
 * The "stored in this browser only" badge used to sit here and was removed on request —
 * it is clutter in a pitch. The constraint itself is unchanged and still documented in
 * README.md and AGENTS.md; do not let anything imply the data syncs or is backed up.
 *
 * Everything below reads the store, and the store only has data after mount, so the
 * first paint is a placeholder rather than an empty network.
 */
import { useMemo } from "react";

import { getGraphData } from "@/lib/core/read";
import { isQuiet, type Network } from "@/lib/core/types";
import { formatMoneyCompact } from "@/lib/core/money";
import NetworkSwitcher from "@/components/network-switcher";
import NetworkView from "@/components/network-view";
import { BTN_QUIET, Notice } from "@/components/primitives";
import { useStore } from "@/lib/store/use-store";

export default function NetworkScreen({ network }: { network: Network }) {
  const { ready, dataset, today, counts, storageError, resetToDemo, clearEverything } = useStore();

  const contacts = useMemo(() => getGraphData(dataset, network), [dataset, network]);
  /**
   * Headcount and money in one pass. `atRisk` sums the annual value of the contacts who
   * have gone quiet — the number this whole screen exists to put in front of someone.
   * Unvalued contacts add nothing rather than counting as zero-value accounts.
   */
  const { quiet, atRisk } = useMemo(() => {
    let quietCount = 0;
    let risk = 0;

    for (const contact of contacts) {
      if (!isQuiet(contact.last_contact_on, today)) continue;
      quietCount++;
      risk += contact.account_value ?? 0;
    }

    return { quiet: quietCount, atRisk: risk };
  }, [contacts, today]);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="shrink-0 border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <span className="text-[22px] font-bold leading-none tracking-[-0.04em] text-foreground">
            Ori
          </span>
          <NetworkSwitcher active={network} counts={counts} />

          <span className="stat stat-quiet">
            <b>{quiet}</b>
            <span className="label-mono">gone quiet</span>
          </span>

          {atRisk > 0 ? (
            <span
              className="stat stat-quiet"
              title="Annual account value of the contacts who have gone quiet. Unvalued contacts are not counted."
            >
              <b>{formatMoneyCompact(atRisk)}</b>
              <span className="label-mono">at risk</span>
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={BTN_QUIET}
              onClick={() => {
                if (window.confirm("Replace everything with the demo network?")) resetToDemo();
              }}
            >
              Reset demo data
            </button>
            <button
              type="button"
              className={`${BTN_QUIET} hover:text-alert`}
              onClick={() => {
                if (window.confirm("Delete every contact in this browser? This cannot be undone."))
                  clearEverything();
              }}
            >
              Delete all
            </button>
          </div>
        </div>

        {storageError ? (
          <div className="mx-auto max-w-[1600px] px-4 pb-3 sm:px-6">
            <Notice tone="caution">{storageError}</Notice>
          </div>
        ) : null}
      </header>

      <main className="min-h-0 flex-1">
        {ready ? (
          <NetworkView network={network} contacts={contacts} today={today} />
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground sm:px-6">Loading your network …</p>
        )}
      </main>
    </div>
  );
}
