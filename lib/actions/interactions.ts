"use server";

/**
 * Interaction adapters. Ownership of the contact is checked in core, not here.
 */
import { revalidatePath } from "next/cache";

import { deleteInteraction, logInteraction } from "@/lib/core/interactions";
import type { Interaction } from "@/lib/core/types";
import {
  errorMessage,
  firstIssue,
  idSchema,
  interactionInputSchema,
  requireNetwork,
  requireUser,
} from "@/lib/actions/shared";

export async function addInteraction(args: {
  network: string;
  input: unknown;
}): Promise<{ error: string | null; interaction: Interaction | null }> {
  try {
    const network = requireNetwork(args.network);
    const parsed = interactionInputSchema.safeParse(args.input);
    if (!parsed.success) return { error: firstIssue(parsed.error), interaction: null };

    const { supabase, userId } = await requireUser();
    const interaction = await logInteraction(supabase, userId, parsed.data);

    revalidatePath(`/dashboard/${network}`);
    return { error: null, interaction };
  } catch (cause) {
    return { error: errorMessage(cause), interaction: null };
  }
}

export async function removeInteraction(args: {
  network: string;
  id: string;
}): Promise<{ error: string | null }> {
  try {
    const network = requireNetwork(args.network);
    const { supabase, userId } = await requireUser();

    await deleteInteraction(supabase, userId, idSchema.parse(args.id));

    revalidatePath(`/dashboard/${network}`);
    return { error: null };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}
