/**
 * Shared contract between core, the store and the UI. Changes here are agreed, never
 * unilateral. This module is framework-free: nothing under lib/core imports from next/*.
 */

/**
 * The mindmap. One network holds the whole address book — business contacts and friends
 * in the same graph, so a colleague who became a friend is one node, not two.
 */
export const NETWORKS = ["connections"] as const;
export type Network = (typeof NETWORKS)[number];

export const NETWORK_LABELS: Record<Network, string> = {
  connections: "Connections",
};

export function isNetwork(value: string): value is Network {
  return (NETWORKS as readonly string[]).includes(value);
}

export const INTERACTION_KINDS = ["call", "message", "meeting", "email", "note"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_LABELS: Record<InteractionKind, string> = {
  call: "Call",
  message: "Message",
  meeting: "Meeting",
  email: "E-mail",
  note: "Note",
};

export type ContactSource = "manual" | "excel";

/** Days without an interaction before a contact counts as gone quiet. */
export const QUIET_AFTER_DAYS = 90;

/**
 * What the contact form and the spreadsheet importer both produce. `company_norm` is
 * derived in core, never supplied by the caller.
 */
export type ContactInput = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Free-text job title (business) — kept as the user typed it. */
  role: string | null;
  city: string | null;
  /** How you know them: "Brother", "University", "Client". Clustering material. */
  relation: string | null;
  tags: string[];
  notes: string | null;
  /** Optional profile link (LinkedIn, Instagram, website). Display only. */
  profile_url: string | null;
  /**
   * Some of this contact's details came from a crowdsourced source rather than from the
   * person themselves, so the UI shows a caution above their card. Provenance only — no
   * data is fetched or exchanged anywhere (see AGENTS.md, "No backend").
   */
  crowdsourced: boolean;
  /**
   * What this relationship is worth per year, in EUR. null when unknown — most personal
   * contacts have no value and must not be counted as zero-value accounts.
   *
   * This is what turns "26 contacts have gone quiet" into "how much revenue is cooling":
   * see `valueAtRisk` in lib/core/graph/clusters.ts.
   */
  account_value: number | null;
};

export type Contact = ContactInput & {
  id: string;
  network: Network;
  company_norm: string | null;
  source: ContactSource;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  contact_id: string;
  kind: InteractionKind;
  occurred_on: string; // ISO date
  note: string | null;
  created_at: string;
};

export type InteractionInput = {
  contact_id: string;
  kind: InteractionKind;
  occurred_on: string;
  note: string | null;
};

/**
 * Everything the app owns, in one value. There is no server and no database: the store
 * keeps exactly this in the browser and every core function takes it as an argument.
 */
export type Dataset = {
  contacts: Contact[];
  interactions: Interaction[];
};

export const EMPTY_DATASET: Dataset = { contacts: [], interactions: [] };

/** The slim projection the mindmap reads. No notes, no timestamps, one network at a time. */
export type GraphContact = {
  id: string;
  first_name: string;
  last_name: string;
  company_norm: string | null;
  role: string | null;
  city: string | null;
  relation: string | null;
  tags: string[];
  /** ISO date of the most recent interaction, null if there is none yet. */
  last_contact_on: string | null;
  interaction_count: number;
  crowdsourced: boolean;
  account_value: number | null;
};

export type AttrKind = "company" | "role" | "city" | "relation" | "tag";

export type PersonNode = {
  kind: "person";
  id: string;
  label: string;
  company: string | null;
  role: string | null;
  city: string | null;
  relation: string | null;
  tags: string[];
  last_contact_on: string | null;
};

export type AttrNode = {
  kind: "attr";
  id: string;
  label: string;
  attr: AttrKind;
  size: number;
};

export type GraphNode = PersonNode | AttrNode;

export type GraphEdge = { source: string; target: string }; // always person -> attr

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** What the filter bar produces. Several values in one dimension OR, dimensions AND. */
export type GraphFilter = {
  companies?: string[];
  roles?: string[];
  cities?: string[];
  relations?: string[];
  tags?: string[];
  /** Free-text match on name, company, role, city, relation, tags. */
  query?: string | null;
  /** Only contacts with no interaction in the last QUIET_AFTER_DAYS days. */
  quietOnly?: boolean;
  /** Person node ids to highlight without hiding anything else. */
  highlightIds?: string[];
};

export type ImportCounts = { inserted: number; updated: number; skipped: number };

/** Whole days between an ISO date and `today`. null in, null out. */
export function daysSince(isoDate: string | null, today: string): number | null {
  if (!isoDate) return null;
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.floor((now - then) / 86_400_000);
}

export function isQuiet(lastContactOn: string | null, today: string): boolean {
  const days = daysSince(lastContactOn, today);
  return days === null || days >= QUIET_AFTER_DAYS;
}

/** YYYY-MM-DD for today in the local timezone. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
