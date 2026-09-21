"use client";

/**
 * The keyboard-operable half of the cluster overview, for the same reason ContactList
 * exists: a canvas cannot be reached with Tab or read by a screen reader, so every
 * cluster you can click in the graph is also a button here.
 *
 * Sorted by headcount, because "which of my accounts is biggest" is the question the
 * overview is for.
 */
import type { AttrKind, AttrNode } from "@/lib/core/types";
import type { ClusterStats } from "@/lib/core/graph/clusters";

const KIND_LABELS: Record<AttrKind, string> = {
  company: "Company",
  role: "Role",
  city: "City",
  relation: "Relation",
  tag: "Tag",
};

export default function ClusterList({
  clusters,
  stats,
  onOpen,
}: {
  clusters: AttrNode[];
  stats: Map<string, ClusterStats>;
  onOpen: (cluster: AttrNode) => void;
}) {
  if (!clusters.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No clusters to show. Switch a dimension on in the rail, or add contacts with a
        company or a relation.
      </p>
    );
  }

  const sorted = [...clusters].sort(
    (a, b) => b.size - a.size || a.label.localeCompare(b.label),
  );

  return (
    <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
      {sorted.map((cluster) => {
        const quiet = stats.get(cluster.id)?.quiet ?? 0;

        return (
          <li key={cluster.id}>
            <button
              type="button"
              onClick={() => onOpen(cluster)}
              className="flex w-full items-baseline justify-between gap-4 border-l-2 border-l-transparent px-4 py-3 text-left hover:bg-secondary"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{cluster.label}</span>
                <span className="label-mono block">{KIND_LABELS[cluster.attr]}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                {quiet > 0 ? <span className="label-mono text-caution">{quiet} quiet</span> : null}
                <span className="label-mono">{cluster.size}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
