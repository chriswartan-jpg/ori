/**
 * The one read the mindmap does. Two queries for a whole network, never one per contact:
 * the contacts, then all their interactions, aggregated in JS.
 *
 * `last_contact_on` is max(occurred_on) computed here on purpose — a denormalized column
 * would need a trigger and could drift, and this page already loads every contact anyway.
 */
import type { Db, GraphContact, Network } from "@/lib/core/types";

const CONTACT_COLUMNS = "id, first_name, last_name, company_norm, role, city, relation, tags";

type ContactRow = Omit<GraphContact, "last_contact_on" | "interaction_count"> & {
  tags: string[] | null;
};

export async function getGraphData(
  supabase: Db,
  userId: string,
  network: Network,
): Promise<GraphContact[]> {
  const contacts = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("user_id", userId)
    .eq("network", network);

  if (contacts.error) throw new Error(contacts.error.message);
  const rows = (contacts.data ?? []) as unknown as ContactRow[];
  if (!rows.length) return [];

  const log = await supabase
    .from("interactions")
    .select("contact_id, occurred_on")
    .eq("user_id", userId)
    .in("contact_id", rows.map((row) => row.id));

  if (log.error) throw new Error(log.error.message);

  const last = new Map<string, string>();
  const count = new Map<string, number>();

  for (const entry of (log.data ?? []) as { contact_id: string; occurred_on: string }[]) {
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
  }));
}
