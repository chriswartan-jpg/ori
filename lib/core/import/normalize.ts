/**
 * Company / name / URL cleanup. Pure, no framework, no database.
 */

const WS = /\s+/g;

/**
 * Trailing legal-form tokens, compared with dots, commas and case stripped.
 * Covers the forms in docs/ARCHITECTURE.md plus the few that always come with them
 * ("GmbH & Co. KG" is four tokens, stripped right to left).
 */
const LEGAL_TOKENS = new Set([
  "gmbh",
  "mbh",
  "ag",
  "ug",
  "ev",
  "inc",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "bv",
  "nv",
  "sa",
  "sarl",
  "se",
  "kg",
  "kgaa",
  "ohg",
  "gbr",
  "co",
  "plc",
  "srl",
  "spa",
  "oy",
  "ab",
  "as",
]);

/** Trim and collapse whitespace. Never lowercased: names are displayed as given. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").replace(WS, " ").trim();
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  return value || null;
}

/**
 * Strip legal forms and suffixes so "Acme GmbH & Co. KG" and "Acme" become one cluster.
 * Returns readable casing (the input's own), because this value is shown as a label.
 * Grouping and filtering compare case-insensitively, see graph/build.ts.
 */
export function normalizeCompany(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? "").replace(WS, " ").trim();
  if (!cleaned) return null;

  // "UG (haftungsbeschränkt)", "Acme (formerly Beta)" - the parenthetical is never identity.
  const tokens = cleaned
    .replace(/\([^)]*\)/g, " ")
    .replace(WS, " ")
    .trim()
    .split(" ");

  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1].toLowerCase().replace(/[.,&]/g, "");
    if (last === "" || LEGAL_TOKENS.has(last)) tokens.pop();
    else break;
  }

  const result = tokens
    .join(" ")
    .replace(/[\s,&.]+$/, "")
    .trim();
  return result || cleaned;
}

/**
 * Canonical LinkedIn profile URL: https://www.linkedin.com/in/<slug>
 * Query parameters and trailing slashes go, empty and non-profile URLs become null.
 * This is the dedupe key, so anything we cannot canonicalise must not become one.
 */
export function normalizeProfileUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const match = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(value);
  if (!match) return null;

  const slug = decodeURIComponent(match[1]).trim().toLowerCase();
  return slug ? `https://www.linkedin.com/in/${slug}` : null;
}

/**
 * Digits plus an optional leading "+", everything else dropped. Not a validator: a German
 * number written "0151 / 234 56-78" and "+49 151 2345678" both survive as something
 * comparable, and garbage becomes null instead of a fake number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  return value.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Tags from either an array or one delimited cell ("kunde; messe | 2024"). Trimmed,
 * empties dropped, deduplicated case-insensitively, first spelling wins.
 */
export function normalizeTags(raw: string[] | string | null | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;|]/);

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of parts) {
    const tag = (part ?? "").replace(WS, " ").trim();
    if (!tag) continue;
    const dedupeKey = tag.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    tags.push(tag);
  }

  return tags;
}
