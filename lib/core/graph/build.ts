/**
 * GraphContact[] -> bipartite graph. Pure, no database - which is why the tests live here.
 *
 * People connect to attribute nodes (company, role, city, relation, tag) and never to each
 * other. There is no edge table and no person-to-person edge anywhere in Ori.
 */
import type { AttrKind, Graph, GraphContact, GraphEdge, GraphNode } from "@/lib/core/types";

const DEFAULT_COMPANY_CAP = 40;
const OTHER_LABEL = "Other";

/** Grouping key: case- and whitespace-insensitive, so "ACME" and "Acme" are one hub. */
const key = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

/** Stable, collision-free node ids: the prefix separates the attribute spaces. */
const nodeId = (attr: AttrKind, value: string) => `${attr}:${key(value)}`;

/** A Set, so a contact tagged "Kunde" and "kunde" counts once towards the hub size. */
type Group = { id: string; label: string; attr: AttrKind; members: Set<string> };

function collect(
  attr: AttrKind,
  contacts: GraphContact[],
  pick: (c: GraphContact) => (string | null)[],
): Map<string, Group> {
  const groups = new Map<string, Group>();

  for (const contact of contacts) {
    for (const raw of pick(contact)) {
      // A null attribute produces no node. There is no "null" hub.
      if (!raw || !raw.trim()) continue;

      const id = nodeId(attr, raw);
      const group = groups.get(id) ?? { id, label: raw.trim(), attr, members: new Set<string>() };
      group.members.add(`person:${contact.id}`);
      groups.set(id, group);
    }
  }

  return groups;
}

/** Keep the biggest companies, bucket the long tail as "Other" so the layout stays readable. */
function capCompanies(groups: Map<string, Group>, cap: number): Map<string, Group> {
  if (groups.size <= cap) return groups;

  const ranked = [...groups.values()].sort((a, b) => b.members.size - a.members.size);
  const kept = new Map<string, Group>(ranked.slice(0, cap).map((g) => [g.id, g]));

  const otherId = nodeId("company", OTHER_LABEL);
  const other: Group =
    kept.get(otherId) ?? { id: otherId, label: OTHER_LABEL, attr: "company", members: new Set() };

  for (const group of ranked.slice(cap)) {
    for (const member of group.members) other.members.add(member);
  }
  kept.set(otherId, other);

  return kept;
}

export function buildGraph(contacts: GraphContact[], opts?: { companyCap?: number }): Graph {
  const cap = opts?.companyCap ?? DEFAULT_COMPANY_CAP;

  const groups = [
    capCompanies(collect("company", contacts, (c) => [c.company_norm]), cap),
    collect("role", contacts, (c) => [c.role]),
    collect("city", contacts, (c) => [c.city]),
    collect("relation", contacts, (c) => [c.relation]),
    collect("tag", contacts, (c) => c.tags),
  ];

  // People are always nodes, even with no attribute at all: an isolated node is
  // still a contact the user owns.
  const nodes: GraphNode[] = contacts.map((c) => ({
    kind: "person",
    id: `person:${c.id}`,
    label: `${c.first_name} ${c.last_name}`.trim(),
    company: c.company_norm,
    role: c.role,
    city: c.city,
    relation: c.relation,
    tags: c.tags,
    last_contact_on: c.last_contact_on,
  }));

  const edges: GraphEdge[] = [];

  for (const dimension of groups) {
    for (const group of dimension.values()) {
      // A hub of one is noise, not structure.
      if (group.members.size < 2) continue;

      nodes.push({
        kind: "attr",
        id: group.id,
        label: group.label,
        attr: group.attr,
        size: group.members.size,
      });
      for (const member of group.members) edges.push({ source: member, target: group.id });
    }
  }

  return { nodes, edges };
}
