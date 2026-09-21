"use client";

/**
 * Spreadsheet import in three steps. The file is read in the browser — as is everything
 * else now — so nothing is written before the user has seen the preview and pressed the
 * confirm button.
 */
import Link from "next/link";
import { useState } from "react";

import { parseSpreadsheet, type ParseResult } from "@/lib/core/import/parse-spreadsheet";
import { CONTACT_TEMPLATE_CSV, CONTACT_TEMPLATE_FILENAME } from "@/lib/core/import/template";
import type { ImportCounts, Network } from "@/lib/core/types";
import { BTN, BTN_QUIET, Notice } from "@/components/primitives";
import { useStore } from "@/lib/store/use-store";

const PREVIEW_ROWS = 20;

const RECOGNIZED =
  "First Name, Last Name, Email, Phone, Company, Role, City, Relation, Tags, Notes, Profile";

function downloadTemplate() {
  const url = URL.createObjectURL(
    new Blob([CONTACT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = CONTACT_TEMPLATE_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ImportWizard({ network }: { network: Network }) {
  const { importRows } = useStore();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [counts, setCounts] = useState<ImportCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const response = importRows(network, result.rows.map((row) => row.contact));

    if (response.error) setError(response.error);
    else {
      setError(null);
      setCounts(response.counts);
    }
  };

  const rows = result?.rows ?? [];

  return (
    <div className="panel divide-y divide-border">
      <section className="space-y-4 p-6">
        <p className="label-mono">1 — Choose a file</p>
        <label className="block">
          <span className="label-mono block pb-1.5">Excel or CSV file</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="w-full px-3 py-2 text-sm file:mr-3 file:rounded-full file:border file:border-border-strong file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickFile(file);
            }}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Recognized columns: {RECOGNIZED}. English or German headers, any order, unknown
          columns are ignored.
        </p>
        <button type="button" className={BTN_QUIET} onClick={downloadTemplate}>
          Download template
        </button>
      </section>

      <section className="space-y-4 p-6">
        <p className="label-mono">2 — Preview</p>

        {parsing ? <p className="text-sm text-muted-foreground">Reading {fileName} …</p> : null}

        {!parsing && !result ? (
          <p className="text-sm text-muted-foreground">No file read yet.</p>
        ) : null}

        {result?.error ? (
          <div className="space-y-2">
            <Notice tone="alert">{result.error}</Notice>
            <p className="text-sm text-muted-foreground">
              Download the template, move your data into it and try again.
            </p>
          </div>
        ) : null}

        {result && !result.error ? (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} rows read
              {result.skipped > 0 ? `, ${result.skipped} skipped for having no name` : ""}. Header
              row: {result.headers.join(", ") || "—"}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-strong">
                    {["Row", "Name", "E-mail", "Company", "Role", "City", "Relation", "Tags"].map(
                      (head) => (
                        <th key={head} className="label-mono py-2 pr-4 font-medium">
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
                      <td className="py-2 pr-4 text-muted-foreground">
                        {row.contact.relation ?? "—"}
                      </td>
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
                Preview shows {PREVIEW_ROWS} of {rows.length} rows
              </p>
            ) : null}

            {rows.some((row) => row.problems.length > 0) ? (
              <div className="space-y-1">
                <p className="label-mono">Remarks</p>
                <ul className="space-y-1 text-sm text-caution">
                  {rows
                    .filter((row) => row.problems.length > 0)
                    .map((row) => (
                      <li key={row.rowNumber}>
                        Row {row.rowNumber}: {row.problems.join(" · ")}
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Remarks do not block the import — those rows are created anyway.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-4 p-6">
        <p className="label-mono">3 — Import</p>

        {counts ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {counts.inserted} contacts created, {counts.skipped} skipped (that e-mail was
              already in this network).
            </p>
            <Link className={BTN} href={`/dashboard/${network}`}>
              Back to the mindmap
            </Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={BTN}
              disabled={!result || Boolean(result.error) || rows.length === 0}
              onClick={confirm}
            >
              Import {rows.length} rows
            </button>
            <p className="text-sm text-muted-foreground">
              Only this click writes to your browser&apos;s storage.
            </p>
          </>
        )}

        {error ? <Notice tone="alert">{error}</Notice> : null}
      </section>
    </div>
  );
}
