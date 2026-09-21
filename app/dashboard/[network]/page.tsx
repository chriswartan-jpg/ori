import { notFound } from "next/navigation";

import { isNetwork } from "@/lib/core/types";
import NetworkScreen from "@/components/network-screen";

/**
 * The core screen. Nothing is loaded here any more — the data lives in the browser, so
 * this only validates the route segment and hands it to the client screen.
 */
export default async function NetworkPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetwork(network)) notFound();

  return <NetworkScreen network={network} />;
}
