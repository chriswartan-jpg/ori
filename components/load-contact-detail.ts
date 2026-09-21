"use server";

/**
 * Read adapter for the detail panel: the graph projection carries no e-mail, phone or
 * notes, and the interaction log is only ever needed for one contact at a time.
 *
 * ponytail: this belongs in lib/actions/ next to the write adapters — ui-agent does not
 * own that directory, so it lives here until core-agent moves it. Same shape as the
 * others: auth, validation, one call into core, no query of its own.
 */
import { getContact } from "@/lib/core/contacts";
import { listInteractions } from "@/lib/core/interactions";
import { errorMessage, idSchema, requireUser } from "@/lib/actions/shared";
import type { Contact, Interaction } from "@/lib/core/types";

export async function loadContactDetail(id: string): Promise<{
  error: string | null;
  contact: Contact | null;
  interactions: Interaction[];
}> {
  try {
    const { supabase, userId } = await requireUser();
    const contactId = idSchema.parse(id);

    const contact = await getContact(supabase, userId, contactId);
    if (!contact) return { error: "Kontakt nicht gefunden.", contact: null, interactions: [] };

    return { error: null, contact, interactions: await listInteractions(supabase, userId, contactId) };
  } catch (cause) {
    return { error: errorMessage(cause), contact: null, interactions: [] };
  }
}
