"use client";

/**
 * Sign in and sign up in one panel. Both actions share the AuthState shape, so the two
 * hooks differ only in which action they call.
 */
import Link from "next/link";
import { useActionState, useState } from "react";

import { signIn, signUp } from "@/lib/actions/auth";
import { BTN, Notice, TextField } from "@/components/primitives";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, { error: null });
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, { error: null });

  const signup = mode === "signup";
  const state = signup ? signUpState : signInState;
  const action = signup ? signUpAction : signInAction;
  const pending = signup ? signUpPending : signInPending;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="font-mono text-sm tracking-[0.35em] text-foreground">
        ORI
      </Link>

      <div className="panel mt-6 p-6">
        <div className="flex gap-1 border-b border-border pb-4">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md border px-3 py-2 text-sm ${
                mode === value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "signin" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>

        <form action={action} className="mt-5 space-y-3">
          <TextField label="E-Mail" name="email" type="email" required />
          <TextField label="Passwort" name="password" type="password" required />
          <button type="submit" className={BTN} disabled={pending}>
            {pending ? "Bitte warten …" : signup ? "Konto erstellen" : "Anmelden"}
          </button>
        </form>

        {state.error ? (
          <div className="mt-4">
            {/* signUp reports "bitte E-Mail bestätigen" in the same field — that is a notice. */}
            <Notice tone={signup ? "caution" : "alert"}>{state.error}</Notice>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-2">
        <p className="label-mono">Demo-Login</p>
        <p className="text-sm text-muted-foreground">demo@ori.local / demo12345</p>
        <p className="text-sm text-muted-foreground">
          Bestätigungsmails landen lokal in Mailpit:{" "}
          <a
            className="underline hover:text-foreground"
            href="http://127.0.0.1:54324"
            target="_blank"
            rel="noopener noreferrer"
          >
            127.0.0.1:54324
          </a>
        </p>
      </div>
    </main>
  );
}
