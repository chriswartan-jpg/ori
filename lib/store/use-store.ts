"use client";

/**
 * The React binding for lib/store/store.ts. No provider and no context: the store is a
 * module, so any client component can read it and every operation is a plain import.
 */
import { useMemo, useSyncExternalStore } from "react";

import { networkCounts } from "@/lib/core/contacts";
import type { Network } from "@/lib/core/types";
import {
  addInteraction,
  clearEverything,
  getServerSnapshot,
  getSnapshot,
  importRows,
  removeContact,
  removeInteraction,
  resetToDemo,
  saveContact,
  subscribe,
  type StoreState,
} from "@/lib/store/store";

/** Stable identity, so it can sit in a dependency array without re-running anything. */
const ACTIONS = {
  saveContact,
  removeContact,
  addInteraction,
  removeInteraction,
  importRows,
  resetToDemo,
  clearEverything,
} as const;

export type Store = StoreState &
  typeof ACTIONS & {
    /** Badge numbers for the network switcher. */
    counts: Record<Network, number>;
  };

export function useStore(): Store {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({ ...state, counts: networkCounts(state.dataset), ...ACTIONS }),
    [state],
  );
}
