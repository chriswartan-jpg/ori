/**
 * Contact reads and writes over the in-memory dataset. Pure: every write takes a Dataset
 * and returns a new one, so the store can just swap its state and persist the result.
 */
import { newId } from "@/lib/core/ids";
import {
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
  normalizeTags,
} from "@/lib/core/import/normalize";
import type { Contact, ContactInput, Dataset, Network } from "@/lib/core/types";
import { NETWORKS } from "@/lib/core/types";

/** ContactInput -> stored fields. `company_norm` is derived here and nowhere else. */
function toFields(patch: Partial<ContactInput>): Partial<Contact> {
  const fields: Partial<Contact> = {};

  if (patch.first_name !== undefined) fields.first_name = patch.first_name.trim();
  if (patch.last_name !== undefined) fields.last_name = patch.last_name.trim();
  if (patch.email !== undefined) fields.email = normalizeEmail(patch.email);
  if (patch.phone !== undefined) fields.phone = normalizePhone(patch.phone);
  if (patch.role !== undefined) fields.role = patch.role?.trim() || null;
  if (patch.city !== undefined) fields.city = patch.city?.trim() || null;
  if (patch.relation !== undefined) fields.relation = patch.relation?.trim() || null;
  if (patch.tags !== undefined) fields.tags = normalizeTags(patch.tags);
  if (patch.notes !== undefined) fields.notes = patch.notes?.trim() || null;
  if (patch.profile_url !== undefined) fields.profile_url = patch.profile_url?.trim() || null;
  if (patch.crowdsourced !== undefined) fields.crowdsourced = patch.crowdsourced;
  if (patch.account_value !== undefined) fields.account_value = patch.account_value;

  // company and company_norm always move together, or the clustering silently rots.
  if (patch.company !== undefined) {
    fields.company = patch.company?.trim() || null;
    fields.company_norm = normalizeCompany(patch.company);
  }

  return fields;
}

const byName = (a: Contact, b: Contact) =>
  a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);

export function listContacts(dataset: Dataset, network: Network): Contact[] {
  return dataset.contacts.filter((contact) => contact.network === network).sort(byName);
}

export function getContact(dataset: Dataset, id: string): Contact | null {
  return dataset.contacts.find((contact) => contact.id === id) ?? null;
}

export function createContact(
  dataset: Dataset,
  network: Network,
  input: ContactInput,
): { dataset: Dataset; contact: Contact } {
  const now = new Date().toISOString();

  const contact: Contact = {
    first_name: "",
    last_name: "",
    email: null,
    phone: null,
    company: null,
    role: null,
    city: null,
    relation: null,
    tags: [],
    notes: null,
    profile_url: null,
    crowdsourced: false,
    account_value: null,
    ...toFields(input),
    id: newId(),
    network,
    company_norm: normalizeCompany(input.company),
    source: "manual",
    created_at: now,
    updated_at: now,
  };

  return {
    dataset: { ...dataset, contacts: [...dataset.contacts, contact] },
    contact,
  };
}

export function updateContact(
  dataset: Dataset,
  id: string,
  patch: Partial<ContactInput>,
): { dataset: Dataset; contact: Contact } {
  const existing = getContact(dataset, id);
  if (!existing) throw new Error("Contact not found.");

  const contact: Contact = {
    ...existing,
    ...toFields(patch),
    updated_at: new Date().toISOString(),
  };

  return {
    dataset: {
      ...dataset,
      contacts: dataset.contacts.map((row) => (row.id === id ? contact : row)),
    },
    contact,
  };
}

/** Cascades to the interaction log — Postgres used to do this with ON DELETE CASCADE. */
export function deleteContact(dataset: Dataset, id: string): Dataset {
  return {
    contacts: dataset.contacts.filter((contact) => contact.id !== id),
    interactions: dataset.interactions.filter((entry) => entry.contact_id !== id),
  };
}

/** Badge numbers for the network switcher. */
export function networkCounts(dataset: Dataset): Record<Network, number> {
  const counts = Object.fromEntries(NETWORKS.map((n) => [n, 0])) as Record<Network, number>;
  for (const contact of dataset.contacts) {
    if (contact.network in counts) counts[contact.network]++;
  }
  return counts;
}
