"use client";

/**
 * Detail panel for the selected contact.
 *
 * The graph projection carries no e-mail, phone or notes, so the full contact and its
 * interaction log are read from the store — which is in memory, so there is nothing to
 * await and no loading state to show.
 */
import { useMemo, useState } from "react";

import { getContact } from "@/lib/core/contacts";
import { listInteractions } from "@/lib/core/interactions";
import {
  INTERACTION_KINDS,
  INTERACTION_LABELS,
  daysSince,
  isQuiet,
  type Contact,
  type GraphContact,
  type InteractionKind,
} from "@/lib/core/types";
import { formatMoney } from "@/lib/core/money";
import EasyMail from "@/components/easymail";
import { BTN, BTN_DANGER, BTN_QUIET, Field, INPUT, Notice } from "@/components/primitives";
import { useStore } from "@/lib/store/use-store";

function lastContactLine(lastContactOn: string | null, today: string) {
  const days = daysSince(lastContactOn, today);
  if (days === null) return "No contact logged yet";
  if (days === 0) return "Last contact: today";
  return `Last contact: ${days} ${days === 1 ? "day" : "days"} ago`;
}

export default function ContactPanel({
  contact,
  today,
  onEdit,
  onDeselect,
}: {
  contact: GraphContact | null;
  today: string;
  onEdit: (contact: Contact) => void;
  onDeselect: () => void;
}) {
  const { dataset, addInteraction, removeInteraction, removeContact } = useStore();
  const [error, setError] = useState<string | null>(null);

  const contactId = contact?.id ?? null;

  const full = useMemo(
    () => (contactId ? getContact(dataset, contactId) : null),
    [dataset, contactId],
  );
  const interactions = useMemo(
    () => (contactId ? listInteractions(dataset, contactId) : []),
    [dataset, contactId],
  );

  if (!contact) {
    return (
      <div className="panel p-6">
        <p className="label-mono">Contact</p>
        <p className="mt-3 text-sm text-muted-foreground">
          The map opens on your clusters — companies, and how you know people. Click one to
          open it and see who is inside, what they do, and who has gone quiet.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          From there, click a person for their details, interactions and notes. Searching
          jumps straight to people.
        </p>
      </div>
    );
  }

  const lastOn = interactions[0]?.occurred_on ?? null;
  const quiet = isQuiet(lastOn, today);

  const submitInteraction = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const result = addInteraction({
      contact_id: contact.id,
      kind: String(data.get("kind") ?? "call") as InteractionKind,
      occurred_on: String(data.get("occurred_on") ?? ""),
      note: String(data.get("note") ?? ""),
    });

    if (result.error) setError(result.error);
    else {
      setError(null);
      form.reset();
    }
  };

  return (
    <div className="panel flex max-h-full flex-col overflow-y-auto">
      {contact.crowdsourced ? (
        <p
          className="border-b border-border bg-secondary px-6 py-3 text-sm text-caution"
          title="Some fields on this contact came from a crowdsourced source, not from the person themselves. Confirm anything you are about to act on."
        >
          Careful — some of this information was crowdsourced, not confirmed by the contact.
        </p>
      ) : null}

      <div className="border-b border-border p-6">
        <p className="label-mono">Contact</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
          {contact.first_name} {contact.last_name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[contact.relation, contact.company_norm, contact.role, contact.city]
            .filter(Boolean)
            .join(" · ") || "No attributes recorded"}
        </p>

        {contact.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {contact.tags.map((tag) => (
              <li key={tag} className="label-mono rounded-full border border-border-strong px-2.5 py-1">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <p
          className={`mt-4 flex items-center gap-2 text-sm ${
            quiet ? "font-medium text-caution" : "text-muted-foreground"
          }`}
        >
          {quiet ? (
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-caution" />
          ) : null}
          {lastContactLine(lastOn, today)}
        </p>

        {contact.account_value !== null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMoney(contact.account_value)} / year
            {quiet ? <span className="text-caution"> — at risk</span> : null}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-b border-border p-6 text-sm">
        {full === null ? (
          <p className="text-muted-foreground">This contact no longer exists.</p>
        ) : (
          <>
            {full.email ? (
              <p>
                <a className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground" href={`mailto:${full.email}`}>
                  {full.email}
                </a>
              </p>
            ) : null}
            {full.phone ? (
              <p>
                <a className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground" href={`tel:${full.phone}`}>
                  {full.phone}
                </a>
              </p>
            ) : null}
            {full.profile_url ? (
              <p>
                <a
                  className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                  href={full.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open profile
                </a>
              </p>
            ) : null}
            {full.notes ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{full.notes}</p>
            ) : null}
            {!full.email && !full.phone && !full.profile_url && !full.notes ? (
              <p className="text-muted-foreground">No contact details and no notes recorded.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="border-b border-border p-6">
        <p className="label-mono">Interactions ({interactions.length})</p>

        {interactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing logged yet. Record the first call or meeting below.
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
                  className={`${BTN_QUIET} -my-1 px-2 text-xs`}
                  aria-label={`Delete the interaction from ${entry.occurred_on}`}
                  onClick={() => {
                    const result = removeInteraction(entry.id);
                    setError(result.error);
                  }}
                >
                  Delete
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
          <Field label="Kind">
            <select className={INPUT} name="kind" defaultValue="call">
              {INTERACTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {INTERACTION_LABELS[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input className={INPUT} type="date" name="occurred_on" defaultValue={today} required />
          </Field>
          <Field label="Note (optional)">
            <input className={INPUT} type="text" name="note" placeholder="What was it about?" />
          </Field>
          <button type="submit" className={BTN}>
            Log interaction
          </button>
        </form>

        {error ? (
          <div className="mt-3">
            <Notice tone="alert">{error}</Notice>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 p-6">
        {full ? (
          <EasyMail contact={full} lastInteraction={interactions[0] ?? null} today={today} />
        ) : null}
        <button
          type="button"
          className={BTN}
          disabled={full === null}
          onClick={() => full && onEdit(full)}
        >
          Edit
        </button>
        <button
          type="button"
          className={BTN_DANGER}
          onClick={() => {
            if (!window.confirm(`Delete ${contact.first_name} ${contact.last_name}?`)) return;
            const result = removeContact(contact.id);
            if (result.error) setError(result.error);
            else onDeselect();
          }}
        >
          Delete contact
        </button>
      </div>
    </div>
  );
}
