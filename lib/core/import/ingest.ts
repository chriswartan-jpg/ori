/**
 * Insert one parsed batch. Never merges and never overwrites: a row whose e-mail already
 * exists in this network is skipped and reported, because a wrong merge is unrecoverable
 * and a skip is not.
 */
import { newId } from "@/lib/core/ids";
import {
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
  normalizeTags,
} from "@/lib/core/import/normalize";
import type { Contact, ContactInput, Dataset, ImportCounts, Network } from "@/lib/core/types";

function toContact(network: Network, input: ContactInput, now: string): Contact {
  return {
    id: newId(),
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
    crowdsourced: input.crowdsourced ?? false,
    account_value: input.account_value ?? null,
    source: "excel",
    created_at: now,
    updated_at: now,
  };
}

/**
 * Every e-mail already in this network, lowercased. The dedupe is deliberately
 * case-insensitive: a stored "Anna@X.com" has to collide with an imported "anna@x.com".
 */
function existingEmails(dataset: Dataset, network: Network): Set<string> {
  const taken = new Set<string>();
  for (const contact of dataset.contacts) {
    if (contact.network !== network) continue;
    const email = normalizeEmail(contact.email);
    if (email) taken.add(email);
  }
  return taken;
}

export function ingestContacts(
  dataset: Dataset,
  network: Network,
  batch: ContactInput[],
): { dataset: Dataset; counts: ImportCounts } {
  const now = new Date().toISOString();
  const taken = existingEmails(dataset, network);

  const added: Contact[] = [];
  let skipped = 0;

  for (const input of batch) {
    const contact = toContact(network, input, now);

    // No e-mail means no dedupe key, so it always goes in.
    if (contact.email && taken.has(contact.email)) {
      skipped++;
      continue;
    }
    if (contact.email) taken.add(contact.email); // duplicates *within* the file, too
    added.push(contact);
  }

  return {
    dataset: { ...dataset, contacts: [...dataset.contacts, ...added] },
    counts: { inserted: added.length, updated: 0, skipped },
  };
}
