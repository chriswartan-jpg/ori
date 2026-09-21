/**
 * Contact reads and writes. RLS already scopes every row to the session user; the explicit
 * `user_id` filter is belt and braces, and it is what makes the service-role client safe
 * to pass in here too.
 */
import {
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
  normalizeTags,
} from "@/lib/core/import/normalize";
import type { Contact, ContactInput, Db, Network } from "@/lib/core/types";
import { NETWORKS } from "@/lib/core/types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Datenbank lieferte keine Zeile zurück.");
  return result.data;
}

/** ContactInput -> column values. `company_norm` is derived here and nowhere else. */
function toColumns(patch: Partial<ContactInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};

  if (patch.first_name !== undefined) columns.first_name = patch.first_name.trim();
  if (patch.last_name !== undefined) columns.last_name = patch.last_name.trim();
  if (patch.email !== undefined) columns.email = normalizeEmail(patch.email);
  if (patch.phone !== undefined) columns.phone = normalizePhone(patch.phone);
  if (patch.role !== undefined) columns.role = patch.role?.trim() || null;
  if (patch.city !== undefined) columns.city = patch.city?.trim() || null;
  if (patch.relation !== undefined) columns.relation = patch.relation?.trim() || null;
  if (patch.tags !== undefined) columns.tags = normalizeTags(patch.tags);
  if (patch.notes !== undefined) columns.notes = patch.notes?.trim() || null;
  if (patch.profile_url !== undefined) columns.profile_url = patch.profile_url?.trim() || null;

  // company and company_norm always move together, or the clustering silently rots.
  if (patch.company !== undefined) {
    columns.company = patch.company?.trim() || null;
    columns.company_norm = normalizeCompany(patch.company);
  }

  return columns;
}

export async function listContacts(
  supabase: Db,
  userId: string,
  network: Network,
): Promise<Contact[]> {
  const result = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("network", network)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  return unwrap(result) as Contact[];
}

export async function getContact(
  supabase: Db,
  userId: string,
  id: string,
): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Contact | null) ?? null;
}

export async function createContact(
  supabase: Db,
  userId: string,
  network: Network,
  input: ContactInput,
): Promise<Contact> {
  const result = await supabase
    .from("contacts")
    .insert({ ...toColumns(input), user_id: userId, network, source: "manual" })
    .select("*")
    .single();

  return unwrap(result) as Contact;
}

export async function updateContact(
  supabase: Db,
  userId: string,
  id: string,
  patch: Partial<ContactInput>,
): Promise<Contact> {
  const result = await supabase
    .from("contacts")
    .update({ ...toColumns(patch), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  return unwrap(result) as Contact;
}

export async function deleteContact(supabase: Db, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Badge numbers for the network switcher. One query, counted in JS. */
export async function networkCounts(
  supabase: Db,
  userId: string,
): Promise<Record<Network, number>> {
  const result = await supabase.from("contacts").select("network").eq("user_id", userId);
  const rows = unwrap(result) as { network: Network }[];

  const counts = Object.fromEntries(NETWORKS.map((n) => [n, 0])) as Record<Network, number>;
  for (const row of rows) {
    if (row.network in counts) counts[row.network]++;
  }
  return counts;
}
