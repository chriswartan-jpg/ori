"use client";

/**
 * One form for create and edit, and one field order for everyone.
 *
 * Company and role come first because most of this address book is work, but they are
 * optional like every other field: a friend with no company is a perfectly good contact,
 * and `relation` is what clusters them instead.
 */
import { useState } from "react";

import type { Contact, Network } from "@/lib/core/types";
import { BTN, BTN_QUIET, Field, INPUT, Notice, TextField } from "@/components/primitives";
import { useStore } from "@/lib/store/use-store";

const FIELDS = {
  first_name: { label: "First name", type: "text" },
  last_name: { label: "Last name", type: "text" },
  company: { label: "Company", type: "text" },
  role: { label: "Role", type: "text" },
  relation: { label: "Relation", type: "text" },
  email: { label: "E-mail", type: "email" },
  phone: { label: "Phone", type: "tel" },
  city: { label: "City", type: "text" },
  tags: { label: "Tags (comma-separated)", type: "text" },
  profile_url: { label: "Profile URL", type: "text" },
  account_value: { label: "Account value (EUR / year)", type: "number" },
} as const;

type FieldName = keyof typeof FIELDS;

const ORDER: FieldName[] = [
  "first_name",
  "last_name",
  "company",
  "role",
  "relation",
  "email",
  "phone",
  "city",
  "account_value",
  "tags",
  "profile_url",
];

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
  const { saveContact } = useStore();
  const [error, setError] = useState<string | null>(null);

  const defaults = (name: FieldName): string => {
    if (!contact) return "";
    if (name === "tags") return contact.tags.join(", ");
    if (name === "account_value") return contact.account_value?.toString() ?? "";
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
      crowdsourced: data.get("crowdsourced") === "on",
      // Left as the raw string: validate.ts turns "" into null and strips separators, so a
      // blank stays "unknown" rather than becoming a zero-value account.
      account_value: text("account_value"),
    };

    const result = saveContact({ network, input, id: contact?.id ?? null });
    if (result.error) setError(result.error);
    else onDone(result.contact?.id ?? null);
  };

  return (
    <div className="panel max-h-full overflow-y-auto p-6">
      <h2 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
        {contact ? "Edit contact" : "New contact"}
      </h2>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
      >
        {ORDER.map((name) => (
          <TextField
            key={name}
            name={name}
            label={FIELDS[name].label}
            type={FIELDS[name].type}
            required={name === "first_name"}
            defaultValue={defaults(name)}
          />
        ))}

        <Field label="Notes">
          <textarea className={INPUT} name="notes" rows={4} defaultValue={contact?.notes ?? ""} />
        </Field>

        <label className="flex items-start gap-2 pt-1 text-sm text-foreground">
          <input
            type="checkbox"
            name="crowdsourced"
            className="mt-0.5 h-4 w-4 shrink-0"
            defaultChecked={contact?.crowdsourced ?? false}
          />
          <span>
            Contains crowdsourced information
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Shows a caution on their card. Nothing is shared anywhere.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-3 pt-1">
          <button type="submit" className={BTN}>
            Save
          </button>
          <button type="button" className={BTN_QUIET} onClick={onCancel}>
            Cancel
          </button>
        </div>

        {error ? <Notice tone="alert">{error}</Notice> : null}
      </form>
    </div>
  );
}
