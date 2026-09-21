/**
 * The interaction log. "Last contacted" is derived from these rows (see read.ts), never
 * stored on the contact, so writing here is the only thing that has to succeed.
 */
import { newId } from "@/lib/core/ids";
import type { Dataset, Interaction, InteractionInput } from "@/lib/core/types";

/** Newest first, and within one day the most recently entered first. */
const byDate = (a: Interaction, b: Interaction) =>
  b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at);

export function listInteractions(dataset: Dataset, contactId: string): Interaction[] {
  return dataset.interactions.filter((entry) => entry.contact_id === contactId).sort(byDate);
}

export function logInteraction(
  dataset: Dataset,
  input: InteractionInput,
): { dataset: Dataset; interaction: Interaction } {
  if (!dataset.contacts.some((contact) => contact.id === input.contact_id)) {
    throw new Error("Contact not found.");
  }

  const interaction: Interaction = {
    id: newId(),
    contact_id: input.contact_id,
    kind: input.kind,
    occurred_on: input.occurred_on,
    note: input.note?.trim() || null,
    created_at: new Date().toISOString(),
  };

  return {
    dataset: { ...dataset, interactions: [...dataset.interactions, interaction] },
    interaction,
  };
}

export function deleteInteraction(dataset: Dataset, id: string): Dataset {
  return {
    ...dataset,
    interactions: dataset.interactions.filter((entry) => entry.id !== id),
  };
}
