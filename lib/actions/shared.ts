/**
 * The trust boundary for every Server Action: session lookup and Zod schemas.
 *
 * Deliberately NOT a "use server" module — these are helpers the actions import, not
 * endpoints the browser may call. No database query belongs here; that is lib/core.
 */
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { INTERACTION_KINDS, NETWORKS } from "@/lib/core/types";
import type { Db, Network } from "@/lib/core/types";

/** Resolves the session and throws when there is none. Every action starts with this. */
export async function requireUser(): Promise<{ supabase: Db; userId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) throw new Error("Nicht angemeldet.");
  return { supabase, userId: data.user.id };
}

export const networkSchema = z.enum(NETWORKS);

/** Route params are strings from the URL, so the network is validated, never trusted. */
export function requireNetwork(value: unknown): Network {
  const parsed = networkSchema.safeParse(value);
  if (!parsed.success) throw new Error("Unbekanntes Netzwerk.");
  return parsed.data;
}

const trimmedOrNull = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ?? "").trim() || null)
    .refine((value) => value === null || value.length <= max, {
      message: `Maximal ${max} Zeichen.`,
    });

export const contactInputSchema = z.object({
  first_name: z.string().trim().max(120).default(""),
  last_name: z.string().trim().max(120).default(""),
  email: trimmedOrNull(200),
  phone: trimmedOrNull(60),
  company: trimmedOrNull(200),
  role: trimmedOrNull(200),
  city: trimmedOrNull(120),
  relation: trimmedOrNull(120),
  tags: z.array(z.string().trim().max(60)).max(40).default([]),
  notes: trimmedOrNull(4000),
  profile_url: trimmedOrNull(500),
}).refine((contact) => contact.first_name !== "" || contact.last_name !== "", {
  message: "Vor- oder Nachname ist erforderlich.",
});

export const interactionInputSchema = z.object({
  contact_id: z.uuid("Ungültige Kontakt-ID."),
  kind: z.enum(INTERACTION_KINDS),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein."),
  note: trimmedOrNull(2000),
});

export const idSchema = z.uuid("Ungültige ID.");

/** Zod's own messages are English; the first issue is what the form shows. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Eingabe ungültig.";
}

/** Actions return `{ error }` rather than throwing, so a form can render the message. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Unbekannter Fehler.";
}
