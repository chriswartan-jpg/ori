"use client";

/**
 * Orchestrates the mindmap: what the canvas shows, what the panel shows, and the two
 * levels you move between.
 *
 * **Clusters first.** The graph opens on the clusters alone — no people — because 125
 * contacts plus their hubs is an unreadable hairball (this was tried; see AGENTS.md
 * "Graph model"). Clicking a cluster opens it: then, and only then, are people drawn, and
 * the panel switches to that cluster's own numbers.
 *
 * Opening a cluster is implemented as a filter on its dimension, so it reuses the same
 * tested `applyFilter` the search box uses rather than a second code path.
 *
 * The people graph is built once per *structure* (who exists and which attributes they
 * carry). Logging an interaction changes last_contact_on but not the structure, and
 * rebuilding would hand react-force-graph new node objects and restart the layout — so
 * the cached nodes are patched in place instead.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { buildGraph } from "@/lib/core/graph/build";
import { buildClusterOverview } from "@/lib/core/graph/clusters";
import { applyFilter } from "@/lib/core/graph/filter";
import {
  NETWORK_LABELS,
  isQuiet,
  type AttrKind,
  type AttrNode,
  type Contact,
  type Graph,
  type GraphContact,
  type GraphFilter,
  type GraphNode,
  type Network,
} from "@/lib/core/types";
import ClusterList from "@/components/cluster-list";
import ClusterPanel from "@/components/cluster-panel";
import ContactForm from "@/components/contact-form";
import ContactList from "@/components/contact-list";
import ContactPanel from "@/components/contact-panel";
import FilterRail from "@/components/filter-rail";
import GraphCanvas from "@/components/graph-canvas";
import { BTN, BTN_QUIET } from "@/components/primitives";

type ForceGraphData = { nodes: GraphNode[]; links: { source: string; target: string }[] };
type Built = { graph: Graph; data: ForceGraphData };

/** Which GraphFilter key opens a cluster of each dimension. */
const DIMENSION_OF: Record<AttrKind, keyof Pick<
  GraphFilter,
  "companies" | "roles" | "cities" | "relations" | "tags"
>> = {
  company: "companies",
  role: "roles",
  city: "cities",
  relation: "relations",
  tag: "tags",
};

/**
 * Company and relation on by default: they are the two dimensions that answer "which
 * account is this" and "how do I know them". Role, city and tag are one click away in the
 * rail, and switching them all on is how you get the dense view back.
 */
const DEFAULT_DIMENSIONS: AttrKind[] = ["company", "relation"];

const EMPTY_HINT =
  "No contacts yet. Company, role and how you know each other are what form the clusters — " +
  "add the first contact, or import a list from a spreadsheet.";

/** Ignores last_contact_on on purpose: it changes without changing the layout. */
function structureKey(contacts: GraphContact[]): string {
  return contacts
    .map((c) => `${c.id}|${c.company_norm}|${c.role}|${c.city}|${c.relation}|${c.tags.join(",")}`)
    .join(";");
}

/** The links handed to react-force-graph are copies: d3 rewrites source/target into node
 *  objects, while applyFilter reads graph.edges as ids. */
function buildStructure(contacts: GraphContact[]): Built {
  const graph = buildGraph(contacts);
  return { graph, data: { nodes: graph.nodes, links: graph.edges.map((edge) => ({ ...edge })) } };
}

export default function NetworkView({
  network,
  contacts,
  today,
}: {
  network: Network;
  contacts: GraphContact[];
  today: string;
}) {
  const [filter, setFilter] = useState<GraphFilter>({ query: "", quietOnly: false });
  const [dimensions, setDimensions] = useState<AttrKind[]>(DEFAULT_DIMENSIONS);
  const [requestedFocus, setFocus] = useState<AttrNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"graph" | "list">("graph");
  const [form, setForm] = useState<{ contact: Contact | null } | null>(null);

  const key = structureKey(contacts);
  // The structure key is the real dependency: `contacts` gets a new identity on every
  // store write, and rebuilding then would hand the force layout new node objects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { graph, data } = useMemo<Built>(() => buildStructure(contacts), [key]);

  // A logged call changes last_contact_on but not the structure. The nodes the layout
  // holds on to must not be touched, so the fresh dates are handed on separately: as a
  // set for the canvas, and as a shallow copy of the node array for the filter.
  const quietIds = useMemo(
    () =>
      new Set(
        contacts.filter((c) => isQuiet(c.last_contact_on, today)).map((c) => `person:${c.id}`),
      ),
    [contacts, today],
  );

  const filterGraph = useMemo<Graph>(() => {
    const dates = new Map(contacts.map((c) => [`person:${c.id}`, c.last_contact_on]));
    return {
      nodes: graph.nodes.map((node) =>
        node.kind === "person" ? { ...node, last_contact_on: dates.get(node.id) ?? null } : node,
      ),
      edges: graph.edges,
    };
  }, [graph, contacts]);

  /** Person node id -> annual account value. Unvalued contacts are simply absent. */
  const values = useMemo(
    () =>
      new Map(
        contacts
          .filter((c) => c.account_value !== null)
          .map((c) => [`person:${c.id}`, c.account_value as number]),
      ),
    [contacts],
  );

  const overview = useMemo(
    () => buildClusterOverview(graph, dimensions, quietIds, values),
    [graph, dimensions, quietIds, values],
  );

  /**
   * The opened cluster, but only if it still exists. Resetting the demo data, deleting a
   * contact or switching a dimension off can all remove the cluster you were looking at,
   * and holding a stale one strands you on a panel reading "0 contacts" with no way to
   * tell why. Derived rather than cleared in an effect, so there is no setState-in-effect.
   */
  const clusterIds = useMemo(
    () => new Set(graph.nodes.filter((node) => node.kind === "attr").map((node) => node.id)),
    [graph],
  );
  const focus = requestedFocus && clusterIds.has(requestedFocus.id) ? requestedFocus : null;

  // Its own node copies, so the cluster simulation and the people simulation cannot
  // fight over the same objects' x/y.
  const clusterData = useMemo<ForceGraphData>(
    () => ({
      nodes: overview.nodes.map((node) => ({ ...node })),
      links: overview.edges.map((edge) => ({ ...edge })),
    }),
    [overview],
  );

  const searching = Boolean(filter.query?.trim());
  // People are drawn once there is something specific to draw: an opened cluster, or a
  // search that already narrows things down.
  const showPeople = focus !== null || searching;

  const effectiveFilter = useMemo<GraphFilter>(
    () => (focus ? { ...filter, [DIMENSION_OF[focus.attr]]: [focus.label] } : filter),
    [filter, focus],
  );

  const { visibleNodeIds } = useMemo(
    () => applyFilter(filterGraph, effectiveFilter, today),
    [filterGraph, effectiveFilter, today],
  );

  const visible = useMemo(
    () =>
      contacts
        .filter((contact) => visibleNodeIds.has(`person:${contact.id}`))
        .sort((a, b) => (a.last_contact_on ?? "").localeCompare(b.last_contact_on ?? "")),
    [contacts, visibleNodeIds],
  );

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const highlightIds = useMemo(
    () => new Set(selectedId ? [`person:${selectedId}`] : []),
    [selectedId],
  );

  /**
   * Typing a search leaves the opened cluster rather than searching inside it: the panel
   * promises that searching jumps straight to people, and an unmatched query inside a
   * cluster otherwise just shows nothing.
   */
  const changeFilter = (next: GraphFilter) => {
    const query = next.query?.trim() ?? "";
    if (query && query !== (filter.query?.trim() ?? "")) setFocus(null);
    setFilter(next);
  };

  const selectPerson = (contactId: string) => {
    setSelectedId(contactId);
    setForm(null);
  };

  const openCluster = (node: AttrNode) => {
    // build.ts buckets the company tail into this node; it is not a value to open.
    if (node.attr === "company" && node.label === "Other") return;
    setFocus(node);
    setSelectedId(null);
    setForm(null);
    setTab("graph");
  };

  const closeCluster = () => {
    setFocus(null);
    setSelectedId(null);
  };

  const rightColumn = form ? (
    <ContactForm
      network={network}
      contact={form.contact}
      onDone={(contactId) => {
        setForm(null);
        if (contactId) setSelectedId(contactId);
      }}
      onCancel={() => setForm(null)}
    />
  ) : selected ? (
    <ContactPanel
      contact={selected}
      today={today}
      onEdit={(contact) => setForm({ contact })}
      onDeselect={() => setSelectedId(null)}
    />
  ) : focus ? (
    <ClusterPanel
      cluster={focus}
      stats={overview.stats.get(focus.id) ?? null}
      contacts={visible}
      today={today}
      onBack={closeCluster}
      onSelect={selectPerson}
    />
  ) : (
    <ContactPanel
      contact={null}
      today={today}
      onEdit={(contact) => setForm({ contact })}
      onDeselect={() => setSelectedId(null)}
    />
  );

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} onClick={() => setForm({ contact: null })}>
            New contact
          </button>
          <Link className={BTN} href={`/dashboard/${network}/import`}>
            Import spreadsheet
          </Link>
        </div>

        {contacts.length === 0 ? (
          <div className="panel p-6">
            <p className="label-mono">Mindmap {NETWORK_LABELS[network]}</p>
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">{EMPTY_HINT}</p>
          </div>
        ) : (
          <div className="panel flex min-h-0 flex-1 flex-col lg:flex-row">
            <FilterRail
              filter={filter}
              onChange={changeFilter}
              dimensions={dimensions}
              onDimensionsChange={setDimensions}
              visible={showPeople ? visible.length : overview.nodes.length}
              total={showPeople ? contacts.length : overview.nodes.length}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-1 border-b border-border px-2">
                {(["graph", "list"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                    className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
                      tab === value
                        ? "border-b-foreground text-foreground"
                        : "border-b-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value === "graph" ? "Graph" : "List"}
                  </button>
                ))}

                {focus ? (
                  <button type="button" className={BTN_QUIET} onClick={closeCluster}>
                    ← {focus.label}
                  </button>
                ) : null}

                <span className="label-mono ml-auto pr-2">
                  {showPeople
                    ? `${visible.length} contacts`
                    : `${overview.nodes.length} clusters`}
                </span>
              </div>

              {tab === "graph" ? (
                showPeople ? (
                  <GraphCanvas
                    graphData={data}
                    visibleNodeIds={visibleNodeIds}
                    highlightIds={highlightIds}
                    quietIds={quietIds}
                    onSelectPerson={selectPerson}
                    onSelectAttr={openCluster}
                  />
                ) : (
                  <GraphCanvas
                    graphData={clusterData}
                    layout="clusters"
                    visibleNodeIds={new Set(clusterData.nodes.map((node) => node.id))}
                    highlightIds={highlightIds}
                    quietIds={quietIds}
                    onSelectPerson={selectPerson}
                    onSelectAttr={openCluster}
                  />
                )
              ) : showPeople ? (
                <ContactList
                  contacts={visible}
                  selectedId={selectedId}
                  today={today}
                  onSelect={selectPerson}
                />
              ) : (
                <ClusterList
                  clusters={overview.nodes}
                  stats={overview.stats}
                  onOpen={openCluster}
                />
              )}
            </div>
          </div>
        )}
      </section>

      <aside className="flex w-full min-h-0 shrink-0 flex-col lg:w-[380px]">{rightColumn}</aside>
    </div>
  );
}
