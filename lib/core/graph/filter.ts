/**
 * Filtering hides nodes, it does not rebuild the graph - otherwise the force layout
 * jumps on every keystroke. So this returns visibility, never a new Graph.
 */
import type { Graph, GraphEdge, GraphFilter, PersonNode } from "@/lib/core/types";
import { isQuiet } from "@/lib/core/types";

const norm = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Several values in one dimension are OR; different dimensions are AND. */
function matchesAny(value: string | null, wanted: string[] | undefined): boolean {
  if (!wanted || !wanted.length) return true;
  const v = norm(value);
  return v ? wanted.some((w) => norm(w) === v) : false;
}

/** One hit is enough: a contact tagged "client, trade fair" matches a filter on "client". */
function matchesSomeTag(tags: string[], wanted: string[] | undefined): boolean {
  if (!wanted || !wanted.length) return true;
  const own = new Set(tags.map(norm));
  return wanted.some((w) => own.has(norm(w)));
}

function matchesPerson(person: PersonNode, filter: GraphFilter, today: string): boolean {
  if (!matchesAny(person.company, filter.companies)) return false;
  if (!matchesAny(person.role, filter.roles)) return false;
  if (!matchesAny(person.city, filter.cities)) return false;
  if (!matchesAny(person.relation, filter.relations)) return false;
  if (!matchesSomeTag(person.tags, filter.tags)) return false;

  if (filter.quietOnly && !isQuiet(person.last_contact_on, today)) return false;

  const query = norm(filter.query);
  if (query) {
    const haystack = [
      person.label,
      person.company,
      person.role,
      person.city,
      person.relation,
      ...person.tags,
    ]
      .map(norm)
      .join(" ");
    if (!haystack.includes(query)) return false;
  }

  return true;
}

/**
 * `today` is an argument so this stays pure and the checks can pin a date.
 * `highlightIds` deliberately does not take part: highlighting hides nothing.
 */
export function applyFilter(
  graph: Graph,
  filter: GraphFilter,
  today: string,
): { visibleNodeIds: Set<string>; visibleEdges: GraphEdge[] } {
  const visibleNodeIds = new Set<string>();

  for (const node of graph.nodes) {
    if (node.kind === "person" && matchesPerson(node, filter, today)) visibleNodeIds.add(node.id);
  }

  // An attribute node is visible exactly while at least one visible person hangs on it.
  const visibleEdges = graph.edges.filter((edge) => visibleNodeIds.has(edge.source));
  for (const edge of visibleEdges) visibleNodeIds.add(edge.target);

  return { visibleNodeIds, visibleEdges };
}

export type Facets = {
  companies: string[];
  roles: string[];
  cities: string[];
  relations: string[];
  tags: string[];
};

/**
 * Options for the filter bar, read off the person nodes rather than the attribute nodes:
 * a company with a single member has no hub but must still be selectable, and the
 * "Other" bucket must not show up as a company you can filter by.
 */
export function collectFacets(graph: Graph): Facets {
  const seen: Record<keyof Facets, Map<string, string>> = {
    companies: new Map(),
    roles: new Map(),
    cities: new Map(),
    relations: new Map(),
    tags: new Map(),
  };

  const add = (dimension: keyof Facets, value: string | null) => {
    const label = (value ?? "").replace(/\s+/g, " ").trim();
    if (!label) return;
    const k = label.toLowerCase();
    if (!seen[dimension].has(k)) seen[dimension].set(k, label);
  };

  for (const node of graph.nodes) {
    if (node.kind !== "person") continue;
    add("companies", node.company);
    add("roles", node.role);
    add("cities", node.city);
    add("relations", node.relation);
    for (const tag of node.tags) add("tags", tag);
  }

  const sorted = (dimension: keyof Facets) =>
    [...seen[dimension].values()].sort((a, b) => a.localeCompare(b, "en"));

  return {
    companies: sorted("companies"),
    roles: sorted("roles"),
    cities: sorted("cities"),
    relations: sorted("relations"),
    tags: sorted("tags"),
  };
}
