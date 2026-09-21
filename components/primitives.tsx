/**
 * The few shared bits of styling, as Tailwind class strings against the tokens in
 * app/globals.css. Buttons are pills; inputs have 10px corners; only the boundary of
 * something you can operate uses --border-strong.
 */
import type { ReactNode } from "react";

export const BTN =
  "inline-flex items-center rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-foreground hover:border-foreground disabled:opacity-50";

export const BTN_QUIET =
  "inline-flex items-center rounded-full border border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50";

export const BTN_DANGER =
  "inline-flex items-center rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-alert hover:border-alert disabled:opacity-50";

export const INPUT = "w-full px-3 py-2 text-sm";

/** Every input gets a visible label; the <label> wrapper gives it its accessible name. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono block pb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function TextField(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={props.label}>
      <input
        className={INPUT}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

/** Error and notice lines look the same everywhere: one line, no icon, no box. */
export function Notice({ tone, children }: { tone: "alert" | "caution" | "muted"; children: ReactNode }) {
  const color =
    tone === "alert" ? "text-alert" : tone === "caution" ? "text-caution" : "text-muted-foreground";
  return (
    <p role={tone === "alert" ? "alert" : undefined} className={`text-sm ${color}`}>
      {children}
    </p>
  );
}
