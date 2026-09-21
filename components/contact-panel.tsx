"use client";

/**
 * Detail panel for the selected contact. The graph projection has no e-mail, phone or
 * notes and no interaction log, so the rest is fetched per selection.
 */
import { useEffect, useState, useTransition } from "react";

import { addInteraction, removeInteraction } from "@/lib/actions/interactions";
import { removeContact } from "@/lib/actions/contacts";
import { loadContactDetail } from "@/components/load-contact-detail";
import {
  INTERACTION_KINDS,
  INTERACTION_LABELS,
  daysSince,
  isQuiet,
  type Contact,
  type GraphContact,
  type Interaction,
  type InteractionKind,
  type Network,
} from "@/lib/core/types";
import { BTN, BTN_DANGER, BTN_QUIET, Field, INPUT, Notice } from "@/components/primitives";

type Detail = { contact: Contact | null; interactions: Interaction[]; error: string | null };

function lastContactLine(lastContactOn: string | null, today: string) {
  const days = daysSince(lastContactOn, today);
  if (days === null) return "Noch kein Kontakt erfasst";
  if (days === 0) return "Letzter Kontakt: heute";
  return `Letzter Kontakt: vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export default function ContactPanel({
  network,
  contact,
  today,
  onEdit,
  onDeselect,
}: {
  network: Network;
  contact: GraphContact | null;
  today: string;
  onEdit: (contact: Contact) => void;
  onDeselect: () => void;
}) {
  // Keyed by contact id instead of reset in the effect: that keeps the panel from
  // flickering on a reload and needs no synchronous setState during the effect.
  const [loaded, setLoaded] = useState<{ id: string; detail: Detail } | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const contactId = contact?.id ?? null;

  useEffect(() => {
    if (!contactId) return;
    let active = true;
    loadContactDetail(contactId).then((result) => {
      if (active) setLoaded({ id: contactId, detail: result });
    });
    return () => {
      active = false;
    };
  }, [contactId, version]);

  const detail = loaded && loaded.id === contactId ? loaded.detail : null;

  if (!contact) {
    return (
      <div className="panel p-6">
        <p className="label-mono">Detail</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Wähle einen Knoten in der Mindmap oder einen Eintrag in der Liste, um Details,
          Interaktionen und Notizen zu sehen.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Attribut-Knoten (Firma, Rolle, Stadt, Beziehung, Tag) setzen beim Klick den passenden
          Filter.
        </p>
      </div>
    );
  }

  const interactions = detail?.interactions ?? [];
  const lastOn = detail ? (interactions[0]?.occurred_on ?? null) : contact.last_contact_on;
  const quiet = isQuiet(lastOn, today);
  const full = detail?.contact ?? null;

  const submitInteraction = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      const result = await addInteraction({
        network,
        input: {
          contact_id: contact.id,
          kind: String(data.get("kind") ?? "call") as InteractionKind,
          occurred_on: String(data.get("occurred_on") ?? ""),
          note: String(data.get("note") ?? ""),
        },
      });
      if (result.error) setError(result.error);
      else {
        setError(null);
        form.reset();
        setVersion((value) => value + 1);
      }
    });
  };

  return (
    <div className="panel flex max-h-full flex-col overflow-y-auto">
      <div className="border-b border-border p-6">
        <h2 className="text-lg text-foreground">
          {contact.first_name} {contact.last_name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[contact.relation, contact.company_norm, contact.role, contact.city]
            .filter(Boolean)
            .join(" · ") || "Keine Attribute erfasst"}
        </p>

        {contact.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {contact.tags.map((tag) => (
              <li key={tag} className="label-mono rounded-md border border-border px-2 py-1">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <p className={`mt-4 text-sm ${quiet ? "text-caution" : "text-muted-foreground"}`}>
          {lastContactLine(lastOn, today)}
        </p>
      </div>

      <div className="space-y-2 border-b border-border p-6 text-sm">
        {full === null ? (
          <p className="text-muted-foreground">Lade Details …</p>
        ) : (
          <>
            {full.email ? (
              <p>
                <a className="underline hover:text-muted-foreground" href={`mailto:${full.email}`}>
                  {full.email}
                </a>
              </p>
            ) : null}
            {full.phone ? (
              <p>
                <a className="underline hover:text-muted-foreground" href={`tel:${full.phone}`}>
                  {full.phone}
                </a>
              </p>
            ) : null}
            {full.profile_url ? (
              <p>
                <a
                  className="underline hover:text-muted-foreground"
                  href={full.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Profil öffnen
                </a>
              </p>
            ) : null}
            {full.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{full.notes}</p> : null}
            {!full.email && !full.phone && !full.profile_url && !full.notes ? (
              <p className="text-muted-foreground">Keine Kontaktdaten und keine Notiz erfasst.</p>
            ) : null}
          </>
        )}
        {detail?.error ? <Notice tone="alert">{detail.error}</Notice> : null}
      </div>

      <div className="border-b border-border p-6">
        <p className="label-mono">Interaktionen ({interactions.length})</p>

        {detail === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Lade Log …</p>
        ) : interactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Noch nichts protokolliert. Trage unten das erste Telefonat oder Treffen ein.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {interactions.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="label-mono">
                    {INTERACTION_LABELS[entry.kind]} · {entry.occurred_on}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={BTN_QUIET}
                  disabled={pending}
                  aria-label={`Interaktion vom ${entry.occurred_on} löschen`}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeInteraction({ network, id: entry.id });
                      if (result.error) setError(result.error);
                      else setVersion((value) => value + 1);
                    })
                  }
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitInteraction(event.currentTarget);
          }}
        >
          <Field label="Art">
            <select className={INPUT} name="kind" defaultValue="call">
              {INTERACTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {INTERACTION_LABELS[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Datum">
            <input className={INPUT} type="date" name="occurred_on" defaultValue={today} required />
          </Field>
          <Field label="Notiz (optional)">
            <input className={INPUT} type="text" name="note" placeholder="Worum ging es?" />
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {pending ? "Speichere …" : "Interaktion erfassen"}
          </button>
        </form>

        {error ? <div className="mt-3"><Notice tone="alert">{error}</Notice></div> : null}
      </div>

      <div className="flex flex-wrap gap-3 p-6">
        <button
          type="button"
          className={BTN}
          disabled={pending || full === null}
          onClick={() => full && onEdit(full)}
        >
          Bearbeiten
        </button>
        <button
          type="button"
          className={BTN_DANGER}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`${contact.first_name} ${contact.last_name} wirklich löschen?`)) return;
            startTransition(async () => {
              const result = await removeContact({ network, id: contact.id });
              if (result.error) setError(result.error);
              else onDeselect();
            });
          }}
        >
          Kontakt löschen
        </button>
      </div>
    </div>
  );
}
