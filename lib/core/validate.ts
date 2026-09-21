/**
 * Input validation for the two forms and the importer.
 *
 * With no server there is no trust boundary to defend, so this is not a security check —
 * it is what turns a half-filled form into one readable message instead of a contact
 * named "" or a date the graph cannot parse.
 */
import { z } from "zod";

import { INTERACTION_KINDS, NETWORKS } from "@/lib/core/types";
import type { Network } from "@/lib/core/types";

export const networkSchema = z.enum(NETWORKS);

/** Route params are strings from the URL, so the network is validated, never trusted. */
export function requireNetwork(value: unknown): Network {
  const parsed = networkSchema.safeParse(value);
  if (!parsed.success) throw new Error("Unknown network.");
  return parsed.data;
}

const trimmedOrNull = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ?? "").trim() || null)
    .refine((value) => value === null || value.length <= max, {
      message: `At most ${max} characters.`,
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
  crowdsourced: z.boolean().default(false),
  // Blank, null or undefined all mean "unknown", never zero: a zero-value account and an
  // unvalued contact are different things and must rank differently.
  account_value: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const amount = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(amount) ? amount : null;
    })
    .refine((amount) => amount === null || amount >= 0, { message: "Account value cannot be negative." }),
}).refine((contact) => contact.first_name !== "" || contact.last_name !== "", {
  message: "A first or last name is required.",
});

export const interactionInputSchema = z.object({
  contact_id: z.string().min(1, "Invalid contact id."),
  kind: z.enum(INTERACTION_KINDS),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "The date must be YYYY-MM-DD."),
  note: trimmedOrNull(2000),
});

/** The most rows one import will take. A bigger file is a mistake, not a use case. */
export const MAX_IMPORT_ROWS = 5000;

export const importRowsSchema = z
  .array(contactInputSchema)
  .max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows per import.`);

/** The first issue is what the form shows. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Operations return `{ error }` rather than throwing, so a form can render the message. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Unknown error.";
}
