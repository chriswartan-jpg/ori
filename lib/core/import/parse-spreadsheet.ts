/**
 * Spreadsheet -> ContactInput[]. Pure parsing: no database, no `company_norm` (ingest
 * derives that), no network. Runs in the browser so the raw file never hits the server.
 *
 * The one failure that matters here is a silent empty import, so a missing name column is
 * a hard error that names the headers we did find.
 */
import Papa from "papaparse";

import { normalizeTags } from "@/lib/core/import/normalize";
import type { ContactInput } from "@/lib/core/types";

export type ParsedRow = {
  contact: ContactInput;
  /** Per-row remarks. Never blocking — the row is imported anyway. */
  problems: string[];
  /** 1-based row number in the original file, so the preview can point at it. */
  rowNumber: number;
};

export type ParseResult = {
  rows: ParsedRow[];
  /** The header row we settled on, as written in the file. */
  headers: string[];
  /** Non-empty rows without any name. Not imported, not an error. */
  skipped: number;
  error: string | null;
};

/** Longest a single cell may be before we flag it. Matches nothing in the schema — it is a smell check. */
const MAX_FIELD_LENGTH = 300;

type Field =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "role"
  | "city"
  | "relation"
  | "tags"
  | "notes"
  | "profile_url";

/**
 * Header aliases, German and English. Keys are already folded by `foldHeader`, so
 * "E-Mail", "e mail" and "EMAIL" all arrive here as "email".
 */
const HEADER_ALIASES: Record<string, Field> = {};

function alias(field: Field, ...names: string[]) {
  for (const name of names) HEADER_ALIASES[foldHeader(name)] = field;
}

alias("first_name", "Vorname", "First Name", "Firstname", "First", "Given Name", "Rufname");
alias("last_name", "Nachname", "Last Name", "Lastname", "Last", "Surname", "Familienname");
alias("full_name", "Name", "Full Name", "Vollständiger Name", "Kontakt");
alias("email", "E-Mail", "EMail", "Email", "Mail", "E-Mail-Adresse", "Email Address");
alias("phone", "Telefon", "Tel", "Phone", "Mobil", "Mobile", "Handy", "Telefonnummer");
alias("company", "Firma", "Unternehmen", "Company", "Arbeitgeber", "Organisation", "Organization");
alias("role", "Rolle", "Position", "Titel", "Title", "Job", "Role", "Jobtitel", "Funktion");
alias("city", "Stadt", "Ort", "City", "Wohnort", "Standort", "Location");
alias("relation", "Beziehung", "Relation", "Verhältnis", "Wie bekannt", "Woher", "Kontext");
alias("tags", "Tags", "Tag", "Schlagworte", "Schlagwörter", "Kategorien", "Kategorie", "Labels");
alias("notes", "Notizen", "Notiz", "Notes", "Note", "Kommentar", "Bemerkung");
alias("profile_url", "Profil", "URL", "Link", "LinkedIn", "Website", "Webseite", "Profil-URL");

/** Case-, umlaut- and separator-insensitive header key. "E-Mail Adresse" -> "emailadresse". */
function foldHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

const cell = (row: string[], index: number | undefined): string =>
  index === undefined ? "" : (row[index] ?? "").toString().replace(/\s+/g, " ").trim();

const orNull = (value: string): string | null => value || null;

function countKnownHeaders(row: string[]): number {
  const fields = new Set<Field>();
  for (const value of row) {
    const field = HEADER_ALIASES[foldHeader((value ?? "").toString())];
    if (field) fields.add(field);
  }
  return fields.size;
}

const isBlankRow = (row: string[]) => row.every((value) => !(value ?? "").toString().trim());

/**
 * Where the table starts. Files exported by hand routinely carry a title line, a blank
 * line and a legend before the real header, so we look for the first row carrying at
 * least two known aliases and fall back to the first non-empty row — which then fails
 * the name-column check loudly rather than importing nothing.
 */
function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (countKnownHeaders(rows[i]) >= 2) return i;
  }
  return rows.findIndex((row) => !isBlankRow(row));
}

/** First column wins, so a file with "Name" and "Nachname" keeps the more specific one. */
function mapColumns(headers: string[]): Partial<Record<Field, number>> {
  const columns: Partial<Record<Field, number>> = {};
  headers.forEach((header, index) => {
    const field = HEADER_ALIASES[foldHeader(header)];
    if (field && columns[field] === undefined) columns[field] = index;
  });
  return columns;
}

/** "Anna Maria Schmidt" -> first "Anna Maria", last "Schmidt". Split at the LAST space. */
function splitFullName(value: string): { first: string; last: string } {
  const at = value.lastIndexOf(" ");
  if (at < 0) return { first: value, last: "" };
  return { first: value.slice(0, at).trim(), last: value.slice(at + 1).trim() };
}

function buildRow(
  row: string[],
  columns: Partial<Record<Field, number>>,
  headerCount: number,
  rowNumber: number,
): ParsedRow | null {
  let first = cell(row, columns.first_name);
  let last = cell(row, columns.last_name);
  const full = cell(row, columns.full_name);

  if (full) {
    // A combined column beside a "Vorname" column is the surname; on its own it is the
    // whole name and gets split.
    if (!first && !last) ({ first, last } = splitFullName(full));
    else if (!last) last = full;
    else if (!first) first = full;
  }

  if (!first && !last) return null;

  const problems: string[] = [];

  const email = cell(row, columns.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push(`E-Mail sieht nicht wie eine Adresse aus: "${email}"`);
  }

  if (row.length > headerCount && row.slice(headerCount).some((v) => (v ?? "").toString().trim())) {
    problems.push("Zeile hat mehr Spalten als die Kopfzeile");
  }

  const contact: ContactInput = {
    first_name: first,
    last_name: last,
    email: orNull(email),
    phone: orNull(cell(row, columns.phone)),
    company: orNull(cell(row, columns.company)),
    role: orNull(cell(row, columns.role)),
    city: orNull(cell(row, columns.city)),
    relation: orNull(cell(row, columns.relation)),
    tags: normalizeTags(cell(row, columns.tags)),
    notes: orNull(cell(row, columns.notes)),
    profile_url: orNull(cell(row, columns.profile_url)),
  };

  for (const [field, value] of Object.entries(contact)) {
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
      problems.push(`Feld "${field}" ist ungewöhnlich lang (${value.length} Zeichen)`);
    }
  }

  return { contact, problems, rowNumber };
}

/** Shared tail: everything after "we have a grid of strings". */
function parseRows(rows: string[][]): ParseResult {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) {
    return { rows: [], headers: [], skipped: 0, error: "Die Datei enthält keine Daten." };
  }

  const headers = rows[headerIndex].map((value) => (value ?? "").toString().trim());
  const columns = mapColumns(headers);

  if (
    columns.first_name === undefined &&
    columns.last_name === undefined &&
    columns.full_name === undefined
  ) {
    const found = headers.filter(Boolean).join(", ") || "keine";
    return {
      rows: [],
      headers,
      skipped: 0,
      error: `Keine Namensspalte gefunden. Gefundene Spalten: ${found}. Erwartet wird eine Spalte "Vorname", "Nachname" oder "Name" — die Vorlage zum Download passt garantiert.`,
    };
  }

  const parsed: ParsedRow[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue; // trailing empties are not "skipped rows"
    const result = buildRow(row, columns, headers.length, i + 1);
    if (result) parsed.push(result);
    else skipped++;
  }

  return { rows: parsed, headers, skipped, error: null };
}

const DELIMITERS = [";", ",", "\t", "|"];

/**
 * Which delimiter the file uses, decided by how many lines agree on a field count.
 *
 * Papaparse's own guess needs a mean field count above 2 across every line it previews,
 * so a single title line or a trailing blank line defeats it: "Vorname;Nachname" plus one
 * data row and a final newline parses as a single column, and the import then dies on
 * "no name column" for a perfectly good file. Hence: decide here, pass it in explicitly.
 *
 * Counting is deliberately quote-blind — it only has to pick the delimiter, and Papaparse
 * handles quoting in the real parse.
 */
function guessDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 30);

  let best = DELIMITERS[0];
  let bestScore = 0;

  for (const delimiter of DELIMITERS) {
    const agreeing = new Map<number, number>();
    for (const line of lines) {
      const fields = line.split(delimiter).length;
      if (fields < 2) continue;
      agreeing.set(fields, (agreeing.get(fields) ?? 0) + 1);
    }

    for (const [fields, lineCount] of agreeing) {
      // Agreeing lines weigh far more than column count, so a notes column full of
      // commas cannot outvote the real delimiter.
      const score = lineCount * 100 + fields;
      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    }
  }

  return best;
}

export function parseCsvText(text: string): ParseResult {
  const withoutBom = text.replace(/^﻿/, "");
  if (!withoutBom.trim()) {
    return { rows: [], headers: [], skipped: 0, error: "Die Datei ist leer." };
  }

  // header:false because the header is not reliably the first line — prelude rows are
  // common. Papaparse still handles quotes and CRLF.
  const result = Papa.parse<string[]>(withoutBom, {
    skipEmptyLines: false,
    delimiter: guessDelimiter(withoutBom),
  });

  return parseRows(result.data.map((row) => (Array.isArray(row) ? row : [])));
}

/** Excel hands back numbers and Date objects; the parser only ever wants text. */
function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Extension wins over MIME type: browsers report .csv as everything from text/plain up. */
function isExcel(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return true;
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) return false;
  return /sheet|excel/.test(file.type);
}

export async function parseSpreadsheet(file: File): Promise<ParseResult> {
  if (!isExcel(file)) return parseCsvText(await file.text());

  // Imported lazily: the browser entry pulls in browser-only code, and the checks run in
  // Node. `readSheet` (not the default export) is what returns rows in read-excel-file 9.x.
  const { readSheet } = await import("read-excel-file/browser");

  try {
    const grid = await readSheet(file);
    return parseRows(grid.map((row) => row.map(toText)));
  } catch {
    return {
      rows: [],
      headers: [],
      skipped: 0,
      error: "Die Excel-Datei konnte nicht gelesen werden. Speichere sie als .xlsx oder .csv und versuche es erneut.",
    };
  }
}
