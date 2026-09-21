import Link from "next/link";
import { notFound } from "next/navigation";

import { isNetwork, NETWORK_LABELS } from "@/lib/core/types";
import ImportWizard from "@/components/import-wizard";

export default async function ImportPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetwork(network)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
          Import — {NETWORK_LABELS[network]}
        </h1>
        <Link
          className="text-sm text-muted-foreground underline decoration-border-strong underline-offset-4 hover:text-foreground"
          href={`/dashboard/${network}`}
        >
          Back to the mindmap
        </Link>
      </div>

      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        The file is read in your browser. You see a preview first and then confirm what gets
        written into this network.
      </p>

      <div className="mt-6">
        <ImportWizard network={network} />
      </div>
    </div>
  );
}
