import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared contract between db, core and ui. Changes here are agreed, never unilateral.
 * This module is framework-free: nothing under lib/core imports from next/*.
 */

/** The three mindmaps. A contact lives in exactly one of them. */
export const NETWORKS = ["business", "friends", "family"] as const;
export type Network = (typeof NETWORKS)[number];

export const NETWORK_LABELS: Record<Network, string> = {
  business: "Business",
  friends: "Freunde",
  family: "Familie",
};

export function isNetwork(value: string): value is Network {
  return (NETWORKS as readonly string[]).includes(value);
}

export const INTERACTION_KINDS = ["call", "message", "meeting", "email", "note"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_LABELS: Record<InteractionKind, string> = {
  call: "Telefonat",
  message: "Nachricht",
  meeting: "Treffen",
  email: "E-Mail",
  note: "Notiz",
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
  /** How you know them: "Bruder", "Studium", "Kundin". Clustering material for friends/family. */
  relation: string | null;
  tags: string[];
  notes: string | null;
  /** Optional profile link (LinkedIn, Instagram, website). Display only. */
  profile_url: string | null;
};

export type Contact = ContactInput & {
  id: string;
  user_id: string;
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

/**
 * Any Supabase client — browser, request-scoped server, or service role. Core takes one
 * as an argument and never creates one, which is what keeps lib/core framework-free.
 */
export type Db = SupabaseClient;
