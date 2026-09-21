import Link from "next/link";

import { BTN } from "@/components/primitives";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="font-mono text-sm tracking-[0.35em] text-foreground">ORI</p>
      <h1 className="mt-6 max-w-xl text-2xl leading-snug text-foreground">
        Drei Mindmaps deines Netzwerks — Business, Freunde, Familie. Du legst sie selbst an und
        siehst, was still geworden ist.
      </h1>
      <div className="mt-8">
        <Link className={BTN} href="/login">
          Anmelden
        </Link>
      </div>
    </main>
  );
}
