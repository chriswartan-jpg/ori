/**
 * Insert one parsed batch. Never merges and never overwrites: a row whose e-mail already
 * exists in this network is skipped and reported, because a wrong merge is unrecoverable
 * and a skip is not.
 */
import {
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
  normalizeTags,
} from "@/lib/core/import/normalize";
import type { ContactInput, Db, ImportCounts, Network } from "@/lib/core/types";

/** Postgres unique_violation. The pre-lookup misses concurrent inserts; this catches them. */
const UNIQUE_VIOLATION = "23505";

type ContactRow = {
  user_id: string;
  network: Network;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_norm: string | null;
  role: string | null;
  city: string | null;
  relation: string | null;
  tags: string[];
  notes: string | null;
  profile_url: string | null;
  source: "excel";
};

function toRow(userId: string, network: Network, input: ContactInput): ContactRow {
  return {
    user_id: userId,
    network,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    company: input.company?.trim() || null,
    company_norm: normalizeCompany(input.company),
    role: input.role?.trim() || null,
    city: input.city?.trim() || null,
    relation: input.relation?.trim() || null,
    tags: normalizeTags(input.tags),
    notes: input.notes?.trim() || null,
    profile_url: input.profile_url?.trim() || null,
    source: "excel",
  };
}

/**
 * Every e-mail already in this network, lowercased. Not an `in (...)` on the batch's own
 * e-mails: the unique index is on `lower(email)`, so a stored "Anna@X.com" has to collide
 * with an imported "anna@x.com" and a case-sensitive `in` would miss it.
 *
 * ponytail: reads the whole network's e-mail column per 200-row batch. Fine for the
 * hundreds of contacts a personal network has; switch to one lookup per import if a
 * network ever runs into the thousands.
 */
async function existingEmails(supabase: Db, userId: string, network: Network): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("contacts")
    .select("email")
    .eq("user_id", userId)
    .eq("network", network)
    .not("email", "is", null);

  if (error) throw new Error(error.message);

  return new Set(
    (data ?? [])
      .map((row: { email: string | null }) => normalizeEmail(row.email))
      .filter((email): email is string => email !== null),
  );
}

export async function ingestContacts(
  supabase: Db,
  userId: string,
  network: Network,
  batch: ContactInput[],
): Promise<ImportCounts> {
  const rows = batch.map((input) => toRow(userId, network, input));
  const taken = await existingEmails(supabase, userId, network);

  const insertable: ContactRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    // No e-mail means no dedupe key, so it always goes in.
    if (row.email && taken.has(row.email)) {
      skipped++;
      continue;
    }
    if (row.email) taken.add(row.email); // duplicates *within* the file, too
    insertable.push(row);
  }

  if (!insertable.length) return { inserted: 0, updated: 0, skipped };

  const { error } = await supabase.from("contacts").insert(insertable);
  if (!error) return { inserted: insertable.length, updated: 0, skipped };

  // The partial unique index is on lower(email), which supabase-js cannot target with
  // onConflict, so the safety net is a one-by-one retry: one racing duplicate must not
  // cost the user the other 199 rows.
  if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

  let inserted = 0;
  for (const row of insertable) {
    const single = await supabase.from("contacts").insert(row);
    if (!single.error) inserted++;
    else if (single.error.code === UNIQUE_VIOLATION) skipped++;
    else throw new Error(single.error.message);
  }

  return { inserted, updated: 0, skipped };
}
