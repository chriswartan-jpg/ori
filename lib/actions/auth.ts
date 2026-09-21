"use server";

/**
 * Auth adapters. Supabase's own error strings are English and leak implementation detail,
 * so they are mapped to one of two German messages and nothing more.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { firstIssue } from "@/lib/actions/shared";

export type AuthState = { error: string | null };

const START = "/dashboard/business";

const credentialsSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
});

function readCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
}

export async function signIn(_prevState: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-Mail oder Passwort ist falsch." };

  redirect(START);
}

export async function signUp(_prevState: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: "Registrierung fehlgeschlagen. Existiert der Account schon?" };

  // With mail confirmation on there is no session yet — the user has to click the link.
  if (!data.session) {
    return { error: "Bitte bestätige die E-Mail, die wir dir geschickt haben." };
  }

  redirect(START);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
