"use client";

/**
 * EasyMail: one button on a contact's card that writes the reconnect e-mail for you,
 * shows it, and sends it.
 *
 * ── How the send works ──────────────────────────────────────────────────────────────────
 * The send is SIMULATED. There is no transport in this build: no SMTP, no provider, no
 * network call of any kind — `deliver()` below is a timer. The flow is real so the product
 * can be demonstrated end to end; wiring an actual send needs a backend and a mail
 * provider, and that decision has not been taken (see AGENTS.md, "No backend").
 *
 * The *consequence* of sending is real, and has to be: it logs an `email` interaction
 * dated today. Without that the contact stays in "worth a call" and keeps being counted
 * as gone quiet, so the app would go on telling you to contact someone you just
 * contacted — which is the one thing this whole feature exists to prevent.
 *
 * Do not let this drift into implying a delivery guarantee anywhere a user would rely on
 * it. The draft itself is honest: `lib/core/easymail.ts` derives every sentence from the
 * contact's own fields, so it can only say things that are in the data.
 *
 * Self-contained on purpose — trigger, dialog and toast all live here, so mounting it
 * costs the contact panel a single line.
 */
import { useEffect, useRef, useState } from "react";

import { buildEasyMailDraft, worthContactingReason } from "@/lib/core/easymail";
import type { Contact, Interaction } from "@/lib/core/types";
import { BTN, BTN_QUIET, Field, INPUT } from "@/components/primitives";
import { useStore } from "@/lib/store/use-store";

/** How long the simulated delivery takes. Long enough to read, short enough to demo. */
const SEND_MS = 650;
const TOAST_MS = 3600;

type Draft = { to: string; subject: string; body: string };
type Phase = "idle" | "open" | "sending";

const deliver = () => new Promise((resolve) => setTimeout(resolve, SEND_MS));

export default function EasyMail({
  contact,
  lastInteraction,
  today,
}: {
  contact: Contact;
  /** The contact's most recent interaction, or null — it sets the draft's opening line. */
  lastInteraction: Interaction | null;
  today: string;
}) {
  const { addInteraction } = useStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const name = `${contact.first_name} ${contact.last_name}`.trim();
  const reason = worthContactingReason(contact, lastInteraction, today);

  const open = () => {
    const built = buildEasyMailDraft({ contact, lastInteraction, today });
    setDraft({ to: built.to ?? "", subject: built.subject, body: built.body });
    setPhase("open");
  };

  const close = () => {
    if (phase !== "sending") setPhase("idle");
  };

  // Escape closes, and the body gets focus so the draft can be edited straight away.
  useEffect(() => {
    if (phase === "idle") return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    bodyRef.current?.focus();

    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-dismiss. setState from a timer callback, never synchronously in the effect body.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const send = async () => {
    if (!draft) return;
    setPhase("sending");
    await deliver();

    // The log entry is the point: it resets "last contacted", drops the contact out of
    // the quiet count, and takes their value out of "at risk".
    const logged = addInteraction({
      contact_id: contact.id,
      kind: "email",
      occurred_on: today,
      note: `EasyMail: ${draft.subject}`,
    });

    setPhase("idle");
    setToast(
      logged.error
        ? `Sent, but could not log it: ${logged.error}`
        : `Email sent to ${draft.to || name} — logged`,
    );
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setToast("Draft copied to clipboard");
    } catch {
      setToast("Could not copy — select the text and copy manually");
    }
  };

  const sending = phase === "sending";

  return (
    <>
      <button type="button" className={BTN} onClick={open}>
        EasyMail
        {reason ? (
          <span aria-hidden="true" className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-caution align-middle" />
        ) : null}
      </button>

      {phase !== "idle" && draft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="easymail-title"
            className="panel max-h-full w-full max-w-xl overflow-y-auto bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p id="easymail-title" className="label-mono">
                EasyMail — {name}
              </p>
              <button type="button" className={BTN_QUIET} onClick={close} disabled={sending}>
                Close
              </button>
            </div>

            {reason ? (
              <p className="mt-3 text-sm text-caution">Worth contacting: {reason}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                This contact is not overdue — you spoke recently. The draft is ready anyway.
              </p>
            )}

            <div className="mt-4 space-y-3">
              <Field label="To">
                <input
                  className={INPUT}
                  type="email"
                  name="easymail-to"
                  value={draft.to}
                  placeholder="No address on this contact — type one"
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                />
              </Field>

              <Field label="Subject">
                <input
                  className={INPUT}
                  type="text"
                  name="easymail-subject"
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </Field>

              <Field label="Message">
                <textarea
                  ref={bodyRef}
                  className={INPUT}
                  name="easymail-body"
                  rows={11}
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={BTN}
                onClick={send}
                disabled={sending || !draft.to.trim()}
              >
                {sending ? "Sending …" : "Send"}
              </button>
              <button type="button" className={BTN_QUIET} onClick={copy} disabled={sending}>
                Copy
              </button>
              {!draft.to.trim() ? (
                <span className="text-sm text-muted-foreground">
                  Add an address to send.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="panel fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-card px-4 py-3 text-sm text-foreground"
        >
          <span aria-hidden="true" className="mr-2 text-confidence">
            ✓
          </span>
          {toast}
        </div>
      ) : null}
    </>
  );
}
