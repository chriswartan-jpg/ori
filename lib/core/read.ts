/**
 * The one read the mindmap does: one network's contacts, with their interaction log
 * folded down to a count and a latest date.
 *
 * `last_contact_on` is max(occurred_on) computed here on purpose — storing it on the
 * contact would mean keeping two things in sync, and this screen walks every contact
 * anyway.
 */
import type { Dataset, GraphContact, Network } from "@/lib/core/types";

export function getGraphData(dataset: Dataset, network: Network): GraphContact[] {
  const rows = dataset.contacts.filter((contact) => contact.network === network);
  if (!rows.length) return [];

  const ids = new Set(rows.map((row) => row.id));
  const last = new Map<string, string>();
  const count = new Map<string, number>();

  for (const entry of dataset.interactions) {
    if (!ids.has(entry.contact_id)) continue;
    count.set(entry.contact_id, (count.get(entry.contact_id) ?? 0) + 1);
    const seen = last.get(entry.contact_id);
    // ISO dates compare correctly as strings, which is the whole reason we store them so.
    if (!seen || entry.occurred_on > seen) last.set(entry.contact_id, entry.occurred_on);
  }

  return rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    company_norm: row.company_norm,
    role: row.role,
    city: row.city,
    relation: row.relation,
    tags: row.tags ?? [],
    last_contact_on: last.get(row.id) ?? null,
    interaction_count: count.get(row.id) ?? 0,
    crowdsourced: row.crowdsourced ?? false,
    account_value: row.account_value ?? null,
  }));
}
