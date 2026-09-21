/**
 * The store: the whole dataset in one module, mirrored to localStorage on every write.
 *
 * This is what replaced lib/actions/ and lib/supabase/. It is a genuine external store
 * read through useSyncExternalStore (see use-store.ts) rather than React state in a
 * context, because localStorage does not exist during the server render — so the first
 * paint is the empty dataset and the real one arrives when the browser subscribes.
 *
 * Every operation is synchronous: there is nothing to await, so the UI needs no pending
 * states and no optimistic updates. A write either succeeds or returns a message.
 *
 * Deliberately not a state management library: a Set of listeners is the whole
 * requirement (see AGENTS.md, "Simplicity is the requirement").
 */
import { createContact, deleteContact, updateContact } from "@/lib/core/contacts";
import { ingestContacts } from "@/lib/core/import/ingest";
import { deleteInteraction, logInteraction } from "@/lib/core/interactions";
import {
  contactInputSchema,
  errorMessage,
  firstIssue,
  importRowsSchema,
  interactionInputSchema,
} from "@/lib/core/validate";
import {
  EMPTY_DATASET,
  todayIso,
  type Contact,
  type Dataset,
  type ImportCounts,
  type Network,
} from "@/lib/core/types";
import { buildSeedDataset } from "@/lib/store/seed";
import { clearDataset, loadDataset, saveDataset } from "@/lib/store/storage";

export type StoreState = {
  /** False until localStorage has been read. The screens render a placeholder meanwhile. */
  ready: boolean;
  dataset: Dataset;
  /** Read once on load, so the server render and the hydrated one cannot disagree. */
  today: string;
  /** Set when a write could not be persisted. The change is still in state. */
  storageError: string | null;
};

const NO_COUNTS: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };

/**
 * One frozen object for the server snapshot: useSyncExternalStore compares snapshots by
 * identity, so handing it a fresh object every call would loop forever.
 */
const SERVER_STATE: StoreState = Object.freeze({
  ready: false,
  dataset: EMPTY_DATASET,
  today: "1970-01-01",
  storageError: null,
});

let state: StoreState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

let loaded = false;

/** Reads storage once, on the first subscription. A first visit gets the demo network. */
function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;

  const today = todayIso();
  const stored = loadDataset();

  if (stored) {
    setState({ ready: true, today, dataset: stored });
    return;
  }

  const seeded = buildSeedDataset(today);
  setState({ ready: true, today, dataset: seeded, storageError: saveDataset(seeded) });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

export const getSnapshot = (): StoreState => state;
export const getServerSnapshot = (): StoreState => SERVER_STATE;

/** The one write path: swap state, mirror to storage, keep any storage message. */
function commit(dataset: Dataset): void {
  setState({ dataset, storageError: saveDataset(dataset) });
}

export function saveContact(args: {
  network: Network;
  input: unknown;
  id?: string | null;
}): { error: string | null; contact: Contact | null } {
  try {
    const parsed = contactInputSchema.safeParse(args.input);
    if (!parsed.success) return { error: firstIssue(parsed.error), contact: null };

    const result = args.id
      ? updateContact(state.dataset, args.id, parsed.data)
      : createContact(state.dataset, args.network, parsed.data);

    commit(result.dataset);
    return { error: null, contact: result.contact };
  } catch (cause) {
    return { error: errorMessage(cause), contact: null };
  }
}

export function removeContact(id: string): { error: string | null } {
  try {
    commit(deleteContact(state.dataset, id));
    return { error: null };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}

export function addInteraction(input: unknown): { error: string | null } {
  try {
    const parsed = interactionInputSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    commit(logInteraction(state.dataset, parsed.data).dataset);
    return { error: null };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}

export function removeInteraction(id: string): { error: string | null } {
  try {
    commit(deleteInteraction(state.dataset, id));
    return { error: null };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}

export function importRows(
  network: Network,
  rows: unknown,
): { error: string | null; counts: ImportCounts } {
  try {
    const parsed = importRowsSchema.safeParse(rows);
    if (!parsed.success) return { error: firstIssue(parsed.error), counts: NO_COUNTS };
    if (!parsed.data.length) return { error: "No rows to import.", counts: NO_COUNTS };

    const result = ingestContacts(state.dataset, network, parsed.data);
    commit(result.dataset);
    return { error: null, counts: result.counts };
  } catch (cause) {
    return { error: errorMessage(cause), counts: NO_COUNTS };
  }
}

/** Throw away the current data and rebuild the demo network. */
export function resetToDemo(): void {
  commit(buildSeedDataset(todayIso()));
}

/** Throw away the current data and start from nothing. */
export function clearEverything(): void {
  clearDataset();
  setState({ dataset: EMPTY_DATASET, storageError: null });
}
