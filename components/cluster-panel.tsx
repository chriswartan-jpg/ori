"use client";

/**
 * What an opened cluster tells you, in the panel where a contact's details otherwise go.
 *
 * The point of opening "Northlight Systems" is not to admire the node — it is to see who
 * is in there, what they do, and which of them you have stopped talking to. So: headcount,
 * how many have gone quiet, what the cluster is made of, and the names to call first.
 */
import { daysSince, isQuiet, type AttrKind, type AttrNode, type GraphContact } from "@/lib/core/types";
import { formatMoney, formatMoneyCompact } from "@/lib/core/money";
import type { ClusterStats } from "@/lib/core/graph/clusters";
import { BTN_QUIET } from "@/components/primitives";

const KIND_LABELS: Record<AttrKind, string> = {
  company: "Company",
  role: "Role",
  city: "City",
  relation: "Relation",
  tag: "Tag",
};

/** The dimensions worth breaking a cluster down by — never the one you opened. */
const BREAKDOWN: { kind: AttrKind; label: string; of: (c: GraphContact) => string[] }[] = [
  { kind: "company", label: "Companies", of: (c) => (c.company_norm ? [c.company_norm] : []) },
  { kind: "role", label: "Roles", of: (c) => (c.role ? [c.role] : []) },
  { kind: "city", label: "Cities", of: (c) => (c.city ? [c.city] : []) },
  { kind: "relation", label: "Relations", of: (c) => (c.relation ? [c.relation] : []) },
  { kind: "tag", label: "Tags", of: (c) => c.tags },
];

const TOP_N = 4;

/** Value -> headcount, biggest first. */
function tally(contacts: GraphContact[], of: (c: GraphContact) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const contact of contacts) {
    for (const value of of(contact)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export default function ClusterPanel({
  cluster,
  stats,
  contacts,
  today,
  onBack,
  onSelect,
}: {
  cluster: AttrNode;
  /** Precomputed headcount and money figures; null if the cluster vanished mid-render. */
  stats: ClusterStats | null;
  contacts: GraphContact[];
  today: string;
  onBack: () => void;
  onSelect: (contactId: string) => void;
}) {
  const quiet = contacts.filter((contact) => isQuiet(contact.last_contact_on, today));

  // Longest silent first, and never-contacted before merely stale.
  const toCall = [...quiet]
    .sort((a, b) => (a.last_contact_on ?? "").localeCompare(b.last_contact_on ?? ""))
    .slice(0, 5);

  return (
    <div className="panel flex max-h-full flex-col overflow-y-auto">
      <div className="border-b border-border p-6">
        <p className="label-mono">{KIND_LABELS[cluster.attr]}</p>
        <h2 className="mt-1 text-lg text-foreground">{cluster.label}</h2>

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-2xl text-foreground">{contacts.length}</p>
            <p className="label-mono">contacts</p>
          </div>
          <div>
            <p className={`text-2xl ${quiet.length ? "text-caution" : "text-foreground"}`}>
              {quiet.length}
            </p>
            <p className="label-mono">gone quiet</p>
          </div>
          {stats && stats.valueAtRisk > 0 ? (
            <div>
              <p className="text-2xl text-caution">{formatMoneyCompact(stats.valueAtRisk)}</p>
              <p className="label-mono">at risk</p>
            </div>
          ) : null}
        </div>

        {stats && stats.value > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {formatMoney(stats.value)} of annual account value in this cluster.
          </p>
        ) : null}

        <button type="button" className={`${BTN_QUIET} mt-3 px-0`} onClick={onBack}>
          ← Back to all clusters
        </button>
      </div>

      <div className="space-y-4 border-b border-border p-6">
        {BREAKDOWN.filter((dimension) => dimension.kind !== cluster.attr).map((dimension) => {
          const rows = tally(contacts, dimension.of);
          if (!rows.length) return null;

          return (
            <div key={dimension.kind}>
              <p className="label-mono pb-1.5">{dimension.label}</p>
              <ul className="space-y-1">
                {rows.slice(0, TOP_N).map(([value, count]) => (
                  <li key={value} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">{value}</span>
                    <span className="label-mono shrink-0">{count}</span>
                  </li>
                ))}
                {rows.length > TOP_N ? (
                  <li className="label-mono">+{rows.length - TOP_N} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="p-6">
        <p className="label-mono">Worth a call</p>
        {toCall.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Everyone here has been contacted in the last 90 days.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {toCall.map((contact) => {
              const days = daysSince(contact.last_contact_on, today);
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left hover:text-foreground"
                    onClick={() => onSelect(contact.id)}
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {contact.first_name} {contact.last_name}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      {contact.account_value !== null ? (
                        <span className="label-mono">{formatMoneyCompact(contact.account_value)}</span>
                      ) : null}
                      <span className="label-mono text-caution">
                        {days === null ? "never" : `${days}d`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
