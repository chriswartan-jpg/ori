import Link from "next/link";
import { notFound } from "next/navigation";

import { isNetwork, NETWORK_LABELS } from "@/lib/core/types";
import ImportWizard from "@/components/import-wizard";

export default async function ImportPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetwork(network)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-lg text-foreground">
          Import — {NETWORK_LABELS[network]}
        </h1>
        <Link className="text-sm text-muted-foreground underline hover:text-foreground" href={`/dashboard/${network}`}>
          Zurück zur Mindmap
        </Link>
      </div>

      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Die Datei wird im Browser gelesen. Du siehst zuerst eine Vorschau und bestätigst
        danach, was in dieses Netzwerk geschrieben wird.
      </p>

      <div className="mt-6">
        <ImportWizard network={network} />
      </div>
    </div>
  );
}
