"use client";

/**
 * The keyboard-operable half of the mindmap. A canvas cannot be reached with Tab or read
 * by a screen reader, so the same selection is available as a list — sorted by whoever
 * has been quiet the longest.
 */
import { daysSince, isQuiet, type GraphContact } from "@/lib/core/types";

function subtitle(contact: GraphContact): string {
  const parts = [contact.relation, contact.company_norm, contact.role, contact.city].filter(Boolean);
  return parts.join(" · ");
}

export default function ContactList({
  contacts,
  selectedId,
  today,
  onSelect,
}: {
  contacts: GraphContact[];
  selectedId: string | null;
  today: string;
  onSelect: (contactId: string) => void;
}) {
  if (!contacts.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No contact matches these filters.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
      {contacts.map((contact) => {
        const days = daysSince(contact.last_contact_on, today);
        const quiet = isQuiet(contact.last_contact_on, today);
        const selected = contact.id === selectedId;

        return (
          <li key={contact.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(contact.id)}
              className={`flex w-full items-baseline justify-between gap-4 border-l-2 px-4 py-3 text-left hover:bg-secondary ${
                selected ? "border-l-foreground bg-secondary" : "border-l-transparent"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  {quiet ? (
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-caution" />
                  ) : null}
                  {contact.first_name} {contact.last_name}
                  {contact.crowdsourced ? (
                    <span
                      className="label-mono ml-2 text-caution"
                      title="Contains crowdsourced information"
                    >
                      CS
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {subtitle(contact) || "—"}
                </span>
              </span>
              <span className={`label-mono shrink-0 ${quiet ? "font-medium text-caution" : ""}`}>
                {days === null ? "never" : `${days}d`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
