"use client";

/**
 * Excel/CSV import in three steps. The file is parsed in the browser, so nothing is
 * written before the user has seen the preview and pressed the confirm button.
 */
import Link from "next/link";
import { useState, useTransition } from "react";

import { importContacts } from "@/lib/actions/import";
import { parseSpreadsheet, type ParseResult } from "@/lib/core/import/parse-spreadsheet";
import { CONTACT_TEMPLATE_CSV, CONTACT_TEMPLATE_FILENAME } from "@/lib/core/import/template";
import type { ImportCounts, Network } from "@/lib/core/types";
import { BTN, BTN_QUIET, Notice } from "@/components/primitives";

/** The Server Action caps one call; a bigger file is sent in several. */
const CHUNK = 5000;
const PREVIEW_ROWS = 20;

const RECOGNIZED =
  "Vorname, Nachname, E-Mail, Telefon, Firma, Rolle, Stadt, Beziehung, Tags, Notizen, Profil";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CONTACT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = CONTACT_TEMPLATE_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ImportWizard({ network }: { network: Network }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [counts, setCounts] = useState<ImportCounts | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importing, startTransition] = useTransition();

  const pickFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setCounts(null);
    setError(null);
    setParsing(true);
    setResult(await parseSpreadsheet(file));
    setParsing(false);
  };

  const confirm = () => {
    if (!result) return;
    const rows = result.rows.map((row) => row.contact);

    startTransition(async () => {
      const total: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };
      for (let index = 0; index < rows.length; index += CHUNK) {
        setProgress(Math.min(index + CHUNK, rows.length));
        const response = await importContacts(network, rows.slice(index, index + CHUNK));
        if (response.error) {
          setError(response.error);
          return;
        }
        total.inserted += response.counts.inserted;
        total.updated += response.counts.updated;
        total.skipped += response.counts.skipped;
      }
      setError(null);
      setCounts(total);
    });
  };

  const rows = result?.rows ?? [];

  return (
    <div className="panel divide-y divide-border">
      <section className="space-y-4 p-6">
        <p className="label-mono">1 — Datei wählen</p>
        <label className="block">
          <span className="label-mono block pb-1.5">Excel- oder CSV-Datei</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="w-full px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickFile(file);
            }}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Erkannte Spalten: {RECOGNIZED}. Deutsche oder englische Kopfzeilen, Reihenfolge
          beliebig, unbekannte Spalten werden ignoriert.
        </p>
        <button type="button" className={BTN_QUIET} onClick={downloadTemplate}>
          Vorlage herunterladen
        </button>
      </section>

      <section className="space-y-4 p-6">
        <p className="label-mono">2 — Vorschau</p>

        {parsing ? <p className="text-sm text-muted-foreground">Lese {fileName} …</p> : null}

        {!parsing && !result ? (
          <p className="text-sm text-muted-foreground">Noch keine Datei gelesen.</p>
        ) : null}

        {result?.error ? (
          <div className="space-y-2">
            <Notice tone="alert">{result.error}</Notice>
            <p className="text-sm text-muted-foreground">
              Lade die Vorlage herunter, übertrage deine Daten hinein und versuche es erneut.
            </p>
          </div>
        ) : null}

        {result && !result.error ? (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} Zeilen gelesen
              {result.skipped > 0 ? `, ${result.skipped} ohne Namen übersprungen` : ""}. Kopfzeile:{" "}
              {result.headers.join(", ") || "—"}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Zeile", "Name", "E-Mail", "Firma", "Rolle", "Stadt", "Beziehung", "Tags"].map(
                      (head) => (
                        <th key={head} className="label-mono py-2 pr-4 font-normal">
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((row) => (
                    <tr key={row.rowNumber} className="border-b border-border align-top">
                      <td className="label-mono py-2 pr-4">{row.rowNumber}</td>
                      <td className="py-2 pr-4">
                        {row.contact.first_name} {row.contact.last_name}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contact.email ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contact.company ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contact.role ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contact.city ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contact.relation ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {row.contact.tags.join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > PREVIEW_ROWS ? (
              <p className="label-mono">
                Vorschau zeigt {PREVIEW_ROWS} von {rows.length} Zeilen
              </p>
            ) : null}

            {rows.some((row) => row.problems.length > 0) ? (
              <div className="space-y-1">
                <p className="label-mono">Hinweise</p>
                <ul className="space-y-1 text-sm text-caution">
                  {rows
                    .filter((row) => row.problems.length > 0)
                    .map((row) => (
                      <li key={row.rowNumber}>
                        Zeile {row.rowNumber}: {row.problems.join(" · ")}
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Hinweise blockieren den Import nicht — die Zeilen werden trotzdem angelegt.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-4 p-6">
        <p className="label-mono">3 — Importieren</p>

        {counts ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {counts.inserted} Kontakte angelegt, {counts.skipped} übersprungen (E-Mail war in
              diesem Netzwerk schon vorhanden).
            </p>
            <Link className={BTN} href={`/dashboard/${network}`}>
              Zur Mindmap
            </Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={BTN}
              disabled={!result || Boolean(result.error) || rows.length === 0 || importing}
              onClick={confirm}
            >
              {importing
                ? `Importiere … ${progress} / ${rows.length}`
                : `${rows.length} Zeilen importieren`}
            </button>
            <p className="text-sm text-muted-foreground">
              Erst dieser Klick schreibt in die Datenbank.
            </p>
          </>
        )}

        {error ? <Notice tone="alert">{error}</Notice> : null}
      </section>
    </div>
  );
}
