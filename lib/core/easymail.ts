/**
 * EasyMail: the reconnect email, written from what we already know about a contact.
 *
 * Pure and deterministic — no model call, no network. Every sentence is derived from the
 * contact's own fields and their last logged interaction, which is the whole reason it can
 * be trusted: the draft can only ever say things that are in the data.
 *
 * This module only writes the draft. The send lives in `components/easymail.tsx` and is
 * SIMULATED — there is no transport in this build. Read that file's header before
 * assuming anything about delivery.
 */
import { daysSince, isQuiet, type Contact, type Interaction, type InteractionKind } from "@/lib/core/types";

export type MailDraft = {
  /** null when the contact has no e-mail address — the UI has to say so. */
  to: string | null;
  subject: string;
  body: string;
};

/** Relations and tags that mean this is a commercial relationship, not a social one. */
const COMMERCIAL = new Set([
  "client",
  "investor",
  "supplier",
  "prospect",
  "customer",
  "key account",
  "partner",
]);

const PAST_TENSE: Record<InteractionKind, string> = {
  call: "spoke",
  message: "messaged",
  meeting: "met",
  email: "e-mailed",
  note: "spoke",
};

const lower = (value: string) => value.trim().toLowerCase();

function isCommercial(contact: Contact): boolean {
  if (contact.relation && COMMERCIAL.has(lower(contact.relation))) return true;
  return contact.tags.some((tag) => COMMERCIAL.has(lower(tag)));
}

/** How long the silence has been, in words. null days means nothing was ever logged. */
function gapPhrase(days: number | null): string {
  if (days === null) return "we have not managed to speak since we connected";
  if (days <= 1) return "we spoke only yesterday";
  if (days < 21) return `we spoke ${days} days ago`;
  if (days < 45) return "it has been a few weeks since we last spoke";

  const months = Math.round(days / 30);
  if (months < 12) return `it has been about ${months} months since we last spoke`;

  const years = days / 365;
  if (years < 1.75) return "it has been over a year since we last spoke";
  return `it has been more than ${Math.floor(years)} years since we last spoke`;
}

/** A note reads as a sentence fragment, so the trailing full stop is dropped. */
const asFragment = (note: string) => note.trim().replace(/[.!?]+$/, "");

function subjectFor(contact: Contact, days: number | null): string {
  const company = contact.company_norm;

  if (days === null) {
    return company ? `Following up since we connected — ${company}` : "Following up since we connected";
  }
  if (days >= 90) {
    return company ? `Long overdue catch-up — ${company}` : "Long overdue catch-up";
  }
  return company ? `Quick follow-up — ${company}` : "Quick follow-up";
}

/** The middle sentence: whatever specific thing we can point at. */
function contextLine(contact: Contact, last: Interaction | null): string | null {
  if (last?.note) {
    return `Last time we ${PAST_TENSE[last.kind]} you mentioned ${asFragment(last.note)}.`;
  }
  if (contact.company_norm && contact.role) {
    return `I hope things are going well at ${contact.company_norm}.`;
  }
  if (contact.company_norm) {
    return `I hope all is well at ${contact.company_norm}.`;
  }
  if (contact.relation) {
    return `It would be good to pick up where we left off.`;
  }
  return null;
}

function askLine(contact: Contact): string {
  return isCommercial(contact)
    ? "Would you have 15 minutes in the next week or two for a quick call?"
    : "Any chance you are free for a coffee or a quick call in the next couple of weeks?";
}

export function buildEasyMailDraft(args: {
  contact: Contact;
  /** The most recent interaction, or null. */
  lastInteraction: Interaction | null;
  today: string;
}): MailDraft {
  const { contact, lastInteraction, today } = args;
  const days = daysSince(lastInteraction?.occurred_on ?? null, today);

  const greeting = contact.first_name.trim() ? `Hi ${contact.first_name.trim()},` : "Hello,";
  // Capitalise whatever the phrase starts with: it is "we spoke ..." for some gaps and
  // "it has been ..." for others, so a `^we` replacement only fixed half of them.
  const gap = gapPhrase(days);
  const opening = `${gap.charAt(0).toUpperCase()}${gap.slice(1)} — and that is on me.`;

  const lines = [
    greeting,
    "",
    [opening, contextLine(contact, lastInteraction)].filter(Boolean).join(" "),
    "",
    askLine(contact),
    "",
    "Best regards,",
  ];

  return {
    to: contact.email,
    subject: subjectFor(contact, days),
    body: lines.join("\n"),
  };
}

/**
 * Why this contact is worth an e-mail today, or null when they are not overdue. Shown in
 * the dialog so the suggestion is never a black box — the user sees the reason and can
 * disagree with it.
 */
export function worthContactingReason(
  contact: Contact,
  lastInteraction: Interaction | null,
  today: string,
): string | null {
  const lastOn = lastInteraction?.occurred_on ?? null;
  if (!isQuiet(lastOn, today)) return null;

  const days = daysSince(lastOn, today);
  const commercial = isCommercial(contact);

  if (days === null) {
    return commercial
      ? "No contact has ever been logged, and this is a commercial relationship."
      : "No contact has ever been logged.";
  }

  const months = Math.round(days / 30);
  const span = months < 12 ? `${months} months` : "over a year";

  return commercial
    ? `${span} of silence on a commercial relationship${contact.company_norm ? ` at ${contact.company_norm}` : ""}.`
    : `${span} of silence.`;
}
