"use client";

/**
 * Orchestrates one network: selection, filters and the Graph/Liste switch.
 *
 * The graph is built once per *structure* (who exists and which attributes they carry).
 * Logging an interaction changes last_contact_on but not the structure, and rebuilding
 * would hand react-force-graph new node objects and restart the layout — so the cached
 * nodes are patched in place instead.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { buildGraph } from "@/lib/core/graph/build";
import { applyFilter, collectFacets } from "@/lib/core/graph/filter";
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
import ContactForm from "@/components/contact-form";
import ContactList from "@/components/contact-list";
import ContactPanel from "@/components/contact-panel";
import FilterBar from "@/components/filter-bar";
import GraphCanvas from "@/components/graph-canvas";
import { BTN } from "@/components/primitives";

type ForceGraphData = { nodes: GraphNode[]; links: { source: string; target: string }[] };
type Built = { graph: Graph; data: ForceGraphData };

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

const EMPTY_HINT: Record<Network, string> = {
  business:
    "Noch keine Geschäftskontakte. Firma und Rolle bilden später die Cluster — lege den ersten Kontakt an oder importiere eine Liste aus Excel.",
  friends:
    "Noch keine Freunde erfasst. Trage ein, woher du dich kennst (Studium, Sportverein, WG) — daraus entstehen die Cluster dieser Mindmap.",
  family:
    "Noch keine Familie erfasst. Trage die Beziehung ein (Mutter, Bruder, Cousine) — die Mindmap gruppiert danach.",
};

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"graph" | "list">("graph");
  const [form, setForm] = useState<{ contact: Contact | null } | null>(null);

  const key = structureKey(contacts);
  // The structure key is the real dependency: `contacts` gets a new identity on every
  // server refresh, and rebuilding then would hand the force layout new node objects.
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

  const facets = useMemo(() => collectFacets(graph), [graph]);
  const { visibleNodeIds } = useMemo(
    () => applyFilter(filterGraph, filter, today),
    [filterGraph, filter, today],
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

  const selectPerson = (contactId: string) => {
    setSelectedId(contactId);
    setForm(null);
  };

  const toggleAttr = (node: AttrNode) => {
    // build.ts buckets the company tail into this node; it is not a value to filter by.
    if (node.attr === "company" && node.label === "Other") return;

    const dimension = DIMENSION_OF[node.attr];
    const current = filter[dimension] ?? [];
    const next = current.includes(node.label)
      ? current.filter((value) => value !== node.label)
      : [...current, node.label];
    setFilter({ ...filter, [dimension]: next });
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
  ) : (
    <ContactPanel
      network={network}
      contact={selected}
      today={today}
      onEdit={(contact) => setForm({ contact })}
      onDeselect={() => setSelectedId(null)}
    />
  );

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 px-6 py-5 lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} onClick={() => setForm({ contact: null })}>
            Kontakt anlegen
          </button>
          <Link className={BTN} href={`/dashboard/${network}/import`}>
            Excel importieren
          </Link>
        </div>

        {contacts.length === 0 ? (
          <div className="panel p-6">
            <p className="label-mono">Mindmap {NETWORK_LABELS[network]}</p>
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">{EMPTY_HINT[network]}</p>
          </div>
        ) : (
          <>
            <FilterBar
              facets={facets}
              filter={filter}
              onChange={setFilter}
              visible={visible.length}
              total={contacts.length}
            />

            <div className="panel flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-border px-2">
                {(["graph", "list"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                    className={`border-b-2 px-3 py-2 text-sm ${
                      tab === value
                        ? "border-b-foreground text-foreground"
                        : "border-b-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value === "graph" ? "Graph" : "Liste"}
                  </button>
                ))}
                <span className="label-mono ml-auto pr-2">
                  {visible.length} sichtbar
                </span>
              </div>

              {tab === "graph" ? (
                <GraphCanvas
                  graphData={data}
                  visibleNodeIds={visibleNodeIds}
                  highlightIds={highlightIds}
                  quietIds={quietIds}
                  onSelectPerson={selectPerson}
                  onSelectAttr={toggleAttr}
                />
              ) : (
                <ContactList
                  contacts={visible}
                  selectedId={selectedId}
                  today={today}
                  onSelect={selectPerson}
                />
              )}
            </div>
          </>
        )}
      </section>

      <aside className="flex w-full min-h-0 shrink-0 flex-col lg:w-[360px]">{rightColumn}</aside>
    </div>
  );
}
