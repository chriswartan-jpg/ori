/**
 * The interaction log. "Last contacted" is derived from these rows (see read.ts), never
 * stored on the contact, so writing here is the only thing that has to succeed.
 */
import type { Db, Interaction, InteractionInput } from "@/lib/core/types";

const COLUMNS = "id, contact_id, kind, occurred_on, note, created_at";

export async function listInteractions(
  supabase: Db,
  userId: string,
  contactId: string,
): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Interaction[];
}

export async function logInteraction(
  supabase: Db,
  userId: string,
  input: InteractionInput,
): Promise<Interaction> {
  // The contact must belong to the caller: without this check a valid session could log
  // against someone else's contact id. RLS on insert would allow it, user_id is our own.
  const owner = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("id", input.contact_id)
    .maybeSingle();

  if (owner.error) throw new Error(owner.error.message);
  if (!owner.data) throw new Error("Kontakt nicht gefunden.");

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      user_id: userId,
      contact_id: input.contact_id,
      kind: input.kind,
      occurred_on: input.occurred_on,
      note: input.note?.trim() || null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Interaction;
}

export async function deleteInteraction(supabase: Db, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("interactions")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}
