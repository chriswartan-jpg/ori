"use client";

/**
 * One form for create and edit. The network only decides the field order — business puts
 * company and role first, friends and family put the relation first — so there is no
 * second form and no per-network component.
 */
import { useState, useTransition } from "react";

import { saveContact } from "@/lib/actions/contacts";
import type { Contact, Network } from "@/lib/core/types";
import { BTN, BTN_QUIET, Field, INPUT, Notice, TextField } from "@/components/primitives";

const FIELDS = {
  first_name: { label: "Vorname", type: "text" },
  last_name: { label: "Nachname", type: "text" },
  company: { label: "Firma", type: "text" },
  role: { label: "Rolle", type: "text" },
  relation: { label: "Beziehung", type: "text" },
  email: { label: "E-Mail", type: "email" },
  phone: { label: "Telefon", type: "tel" },
  city: { label: "Stadt", type: "text" },
  tags: { label: "Tags (Komma-getrennt)", type: "text" },
  profile_url: { label: "Profil-URL", type: "text" },
} as const;

type FieldName = keyof typeof FIELDS;

const PERSONAL: FieldName[] = [
  "first_name",
  "last_name",
  "relation",
  "city",
  "email",
  "phone",
  "company",
  "role",
  "tags",
  "profile_url",
];

const ORDER: Record<Network, FieldName[]> = {
  business: [
    "first_name",
    "last_name",
    "company",
    "role",
    "email",
    "phone",
    "city",
    "relation",
    "tags",
    "profile_url",
  ],
  friends: PERSONAL,
  family: PERSONAL,
};

export default function ContactForm({
  network,
  contact,
  onDone,
  onCancel,
}: {
  network: Network;
  contact: Contact | null;
  onDone: (contactId: string | null) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaults = (name: FieldName): string => {
    if (!contact) return "";
    if (name === "tags") return contact.tags.join(", ");
    return contact[name] ?? "";
  };

  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();

    const input = {
      first_name: text("first_name"),
      last_name: text("last_name"),
      email: text("email"),
      phone: text("phone"),
      company: text("company"),
      role: text("role"),
      city: text("city"),
      relation: text("relation"),
      tags: text("tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: text("notes"),
      profile_url: text("profile_url"),
    };

    startTransition(async () => {
      const result = await saveContact({ network, input, id: contact?.id ?? null });
      if (result.error) setError(result.error);
      else onDone(result.contact?.id ?? null);
    });
  };

  return (
    <div className="panel max-h-full overflow-y-auto p-6">
      <p className="label-mono">{contact ? "Kontakt bearbeiten" : "Kontakt anlegen"}</p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
      >
        {ORDER[network].map((name) => (
          <TextField
            key={name}
            name={name}
            label={FIELDS[name].label}
            type={FIELDS[name].type}
            required={name === "first_name"}
            defaultValue={defaults(name)}
          />
        ))}

        <Field label="Notizen">
          <textarea className={INPUT} name="notes" rows={4} defaultValue={contact?.notes ?? ""} />
        </Field>

        <div className="flex flex-wrap gap-3 pt-1">
          <button type="submit" className={BTN} disabled={pending}>
            {pending ? "Speichere …" : "Speichern"}
          </button>
          <button type="button" className={BTN_QUIET} onClick={onCancel} disabled={pending}>
            Abbrechen
          </button>
        </div>

        {error ? <Notice tone="alert">{error}</Notice> : null}
      </form>
    </div>
  );
}
