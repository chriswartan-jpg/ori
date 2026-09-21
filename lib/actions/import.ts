"use server";

/**
 * Import adapter. The file is parsed in the browser, so what arrives here is untrusted
 * JSON — it gets the full Zod pass before any of it reaches the database.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ingestContacts } from "@/lib/core/import/ingest";
import type { ImportCounts } from "@/lib/core/types";
import {
  contactInputSchema,
  errorMessage,
  firstIssue,
  requireNetwork,
  requireUser,
} from "@/lib/actions/shared";

/** Server Action payloads are capped; 200 rows per call keeps us well under it. */
const BATCH_SIZE = 200;

/** One import call carries at most this many rows. Beyond it the client sends twice. */
const MAX_ROWS = 5000;

const EMPTY: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };

const rowsSchema = z.array(contactInputSchema).max(MAX_ROWS, `Maximal ${MAX_ROWS} Zeilen pro Import.`);

export async function importContacts(
  network: string,
  rows: unknown,
): Promise<{ error: string | null; counts: ImportCounts }> {
  try {
    const validNetwork = requireNetwork(network);
    const parsed = rowsSchema.safeParse(rows);
    if (!parsed.success) return { error: firstIssue(parsed.error), counts: EMPTY };
    if (!parsed.data.length) return { error: "Keine Zeilen zum Importieren.", counts: EMPTY };

    const { supabase, userId } = await requireUser();

    const counts: ImportCounts = { ...EMPTY };
    for (let i = 0; i < parsed.data.length; i += BATCH_SIZE) {
      const batch = await ingestContacts(
        supabase,
        userId,
        validNetwork,
        parsed.data.slice(i, i + BATCH_SIZE),
      );
      counts.inserted += batch.inserted;
      counts.updated += batch.updated;
      counts.skipped += batch.skipped;
    }

    revalidatePath(`/dashboard/${validNetwork}`);
    return { error: null, counts };
  } catch (cause) {
    return { error: errorMessage(cause), counts: EMPTY };
  }
}
