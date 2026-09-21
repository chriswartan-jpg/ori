"use server";

/**
 * Contact adapters: auth, Zod, one call into core, revalidatePath. Nothing else — no
 * `.from('contacts')` may ever appear in this file.
 */
import { revalidatePath } from "next/cache";

import { createContact, deleteContact, updateContact } from "@/lib/core/contacts";
import type { Contact } from "@/lib/core/types";
import {
  contactInputSchema,
  errorMessage,
  firstIssue,
  idSchema,
  requireNetwork,
  requireUser,
} from "@/lib/actions/shared";

/** One action for create and update: `id` absent means create. */
export async function saveContact(args: {
  network: string;
  input: unknown;
  id?: string | null;
}): Promise<{ error: string | null; contact: Contact | null }> {
  try {
    const network = requireNetwork(args.network);
    const parsed = contactInputSchema.safeParse(args.input);
    if (!parsed.success) return { error: firstIssue(parsed.error), contact: null };

    const { supabase, userId } = await requireUser();

    const contact = args.id
      ? await updateContact(supabase, userId, idSchema.parse(args.id), parsed.data)
      : await createContact(supabase, userId, network, parsed.data);

    revalidatePath(`/dashboard/${network}`);
    return { error: null, contact };
  } catch (cause) {
    return { error: errorMessage(cause), contact: null };
  }
}

export async function removeContact(args: {
  network: string;
  id: string;
}): Promise<{ error: string | null }> {
  try {
    const network = requireNetwork(args.network);
    const { supabase, userId } = await requireUser();

    await deleteContact(supabase, userId, idSchema.parse(args.id));

    revalidatePath(`/dashboard/${network}`);
    return { error: null };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}
