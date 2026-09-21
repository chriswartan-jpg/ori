/**
 * The overview the mindmap opens on: the clusters only, no people.
 *
 * 125 contacts plus their hubs is ~180 nodes and several hundred edges — an unreadable
 * hairball on first paint. So the first screen is the ~50 attribute nodes on their own,
 * sized by headcount, and the people appear only once one cluster is opened.
 *
 * Derived from the bipartite graph rather than from the contacts again: `buildGraph`
 * already decided what a cluster is and who belongs to it, and two answers to that
 * question would drift apart.
 */
import type { AttrKind, AttrNode, Graph, GraphEdge } from "@/lib/core/types";

/** Two clusters are linked when at least this many people belong to both. */
const MIN_SHARED = 3;

/**
 * Strongest links kept per cluster. Without a cap, company/role/city all overlap with each
 * other and the overview becomes the hairball it exists to avoid.
 */
const LINKS_PER_CLUSTER = 3;

export type ClusterStats = {
  id: string;
  label: string;
  attr: AttrKind;
  /** People in this cluster. */
  size: number;
  /** How many of them have gone quiet — the number worth acting on. */
  quiet: number;
  /** Annual value of every valued contact in the cluster, in EUR. */
  value: number;
  /** Annual value of the ones who have gone quiet: the revenue that is cooling. */
  valueAtRisk: number;
};

export type ClusterOverview = {
  /** Cluster nodes, ready to hand to the canvas. */
  nodes: AttrNode[];
  /** Cluster-to-cluster links, sparse by construction. */
  edges: GraphEdge[];
  stats: Map<string, ClusterStats>;
};

/** Person node ids per cluster id, read off the person -> attr edges. */
export function clusterMembers(graph: Graph): Map<string, Set<string>> {
  const members = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    const set = members.get(edge.target);
    if (set) set.add(edge.source);
    else members.set(edge.target, new Set([edge.source]));
  }

  return members;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** How many people two clusters have in common. Iterates the smaller side. */
function sharedCount(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const member of small) if (large.has(member)) shared++;
  return shared;
}

/**
 * `kinds` is which dimensions the user has switched on. `quietIds` are person node ids
 * with no interaction, or none for QUIET_AFTER_DAYS. `values` maps a person node id to
 * their annual account value.
 *
 * Both are passed in rather than read off the nodes because they change without changing
 * the graph's structure — logging a call or editing a value must not restart the layout.
 */
export function buildClusterOverview(
  graph: Graph,
  kinds: readonly AttrKind[],
  quietIds: Set<string>,
  values: Map<string, number> = new Map(),
): ClusterOverview {
  const wanted = new Set(kinds);
  const members = clusterMembers(graph);

  const nodes = graph.nodes.filter(
    (node): node is AttrNode => node.kind === "attr" && wanted.has(node.attr),
  );

  const stats = new Map<string, ClusterStats>();
  for (const node of nodes) {
    const own = members.get(node.id) ?? new Set<string>();
    let quiet = 0;
    let value = 0;
    let valueAtRisk = 0;

    for (const member of own) {
      const amount = values.get(member) ?? 0;
      value += amount;
      if (quietIds.has(member)) {
        quiet++;
        valueAtRisk += amount;
      }
    }

    stats.set(node.id, {
      id: node.id,
      label: node.label,
      attr: node.attr,
      size: own.size,
      quiet,
      value,
      valueAtRisk,
    });
  }

  // Every pair above the threshold, then thinned to each cluster's strongest few.
  const candidates: { source: string; target: string; shared: number }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      // Two companies never share a person (a contact has one company), so same-dimension
      // pairs are only worth testing for tags, where they can genuinely overlap.
      if (a.attr === b.attr && a.attr !== "tag") continue;

      const shared = sharedCount(
        members.get(a.id) ?? new Set(),
        members.get(b.id) ?? new Set(),
      );
      if (shared >= MIN_SHARED) candidates.push({ source: a.id, target: b.id, shared });
    }
  }

  candidates.sort((x, y) => y.shared - x.shared);

  const kept = new Map<string, GraphEdge>();
  const degree = new Map<string, number>();
  const at = (id: string) => degree.get(id) ?? 0;

  for (const candidate of candidates) {
    if (at(candidate.source) >= LINKS_PER_CLUSTER) continue;
    if (at(candidate.target) >= LINKS_PER_CLUSTER) continue;

    const key = pairKey(candidate.source, candidate.target);
    if (kept.has(key)) continue;

    kept.set(key, { source: candidate.source, target: candidate.target });
    degree.set(candidate.source, at(candidate.source) + 1);
    degree.set(candidate.target, at(candidate.target) + 1);
  }

  return { nodes, edges: [...kept.values()], stats };
}

export type ColdCluster = ClusterStats & {
  /** Quiet members as a fraction of the cluster, 0..1. */
  quietShare: number;
};

/**
 * The accounts you are closest to losing — the demo's headline number.
 *
 * Ranked by **money at risk** first: an account worth €400k with two quiet contacts
 * matters more than one worth €20k with five. Quiet headcount breaks ties, and share
 * breaks those, so unvalued clusters still rank sensibly among themselves.
 *
 * Defaults to companies: "which of my accounts is cooling" is the question worth putting
 * on a slide, where "which of my cities is cooling" is not.
 */
export function coldestClusters(
  overview: ClusterOverview,
  opts?: { kinds?: readonly AttrKind[]; limit?: number; minSize?: number },
): ColdCluster[] {
  const kinds = new Set(opts?.kinds ?? (["company"] as const));
  const minSize = opts?.minSize ?? 2;
  const limit = opts?.limit ?? 5;

  return [...overview.stats.values()]
    .filter((stat) => kinds.has(stat.attr) && stat.size >= minSize && stat.quiet > 0)
    .map((stat) => ({ ...stat, quietShare: stat.quiet / stat.size }))
    .sort(
      (a, b) =>
        b.valueAtRisk - a.valueAtRisk ||
        b.quiet - a.quiet ||
        b.quietShare - a.quietShare ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}
