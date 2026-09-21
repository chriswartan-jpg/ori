/**
 * Where the data actually lives now: one JSON blob in localStorage, per browser.
 *
 * There is no server and no account, so this is the whole persistence story. It follows
 * that the data is per-browser and per-device, and that clearing site data deletes it —
 * the UI says so rather than pretending otherwise.
 */
import { EMPTY_DATASET, type Dataset } from "@/lib/core/types";

/**
 * Bump the suffix if the shape ever changes incompatibly; an old blob is then ignored.
 * v2: the three networks collapsed into one, so every stored `network` value from v1
 * ("business", "friends", "family") would match nothing and the graph would come up empty.
 * v3: contacts gained `account_value`. A v2 blob is readable (the field just reads null),
 * but every "money at risk" figure would be zero until the user reset the demo by hand.
 */
const KEY = "ori.dataset.v3";

/** Cheap shape check. A blob written by a different version is dropped, not patched. */
function isDataset(value: unknown): value is Dataset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Dataset>;
  return Array.isArray(candidate.contacts) && Array.isArray(candidate.interactions);
}

/**
 * `null` means "nothing usable stored" — a first visit, private browsing with storage
 * blocked, or a blob from an older shape. The caller seeds in that case.
 */
export function loadDataset(): Dataset | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDataset(parsed) ? { ...EMPTY_DATASET, ...parsed } : null;
  } catch {
    return null;
  }
}

/** Returns an error message rather than throwing: a full quota must not lose the screen. */
export function saveDataset(dataset: Dataset): string | null {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(dataset));
    return null;
  } catch {
    return "Could not save to this browser's storage. The change is visible but will be lost on reload.";
  }
}

export function clearDataset(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: storage is blocked, so there was nothing stored to remove.
  }
}
