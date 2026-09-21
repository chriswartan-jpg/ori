"use client";

/**
 * The mindmap. react-force-graph-2d touches `window`, so it is loaded with ssr: false —
 * only legal inside a Client Component, which this is.
 *
 * Filtering never rebuilds `graphData`: hidden nodes stay in the simulation and are just
 * not drawn (nodeVisibility / linkVisibility). Rebuilding would restart the layout and
 * make the whole map jump on every keystroke.
 *
 * Visual language ("Signal", see AGENTS.md §10): a looked-after person is a dim dot, a
 * quiet one is drawn in amber with a soft halo so it is the brightest thing on the map,
 * and every hub is ringed and captioned in the colour of its dimension.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";

import type { AttrKind, AttrNode, GraphNode } from "@/lib/core/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

/**
 * next/dynamic drops the component's generics, so the accessors arrive with the loose
 * NodeObject / LinkObject types and are narrowed here. Our own nodes are always GraphNode.
 */
type Datum = GraphNode & { x?: number; y?: number };
const asDatum = (node: NodeObject): Datum => node as unknown as Datum;

/** d3 replaces the string ends with node objects once the simulation starts. */
function endId(end: LinkObject["source"]): string {
  if (end === null || end === undefined) return "";
  return typeof end === "object" ? String(end.id ?? "") : String(end);
}

/**
 * Canvas needs literal colors. Read once from the tokens in app/globals.css so they stay
 * the single source of truth and no hex value is duplicated into TypeScript.
 */
type Palette = {
  foreground: string;
  muted: string;
  background: string;
  caution: string;
  person: string;
  edge: string;
  edgeActive: string;
  hub: Record<AttrKind, string>;
  sans: string;
  mono: string;
};
let palette: Palette | null = null;
function tokens(): Palette {
  if (!palette) {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    palette = {
      foreground: read("--foreground"),
      muted: read("--muted-foreground"),
      background: read("--background"),
      caution: read("--caution"),
      person: read("--graph-person"),
      edge: read("--graph-edge"),
      edgeActive: read("--graph-edge-active"),
      hub: {
        company: read("--hub-company"),
        role: read("--hub-role"),
        city: read("--hub-city"),
        relation: read("--hub-relation"),
        tag: read("--hub-tag"),
      },
      // next/font puts the resolved family names in these variables. A canvas font string
      // cannot contain var(), so the value has to be read out here.
      sans: read("--font-space-grotesk") || "sans-serif",
      mono: read("--font-jetbrains-mono") || "monospace",
    };
  }
  return palette;
}

/** rgba() from a #rrggbb token, for the quiet halo. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const PERSON_RADIUS = 3.2;
const QUIET_RADIUS = 3.8;
const SELECTED_RADIUS = 4.5;
const HALO_RADIUS = 11;
/** Below this zoom, person labels would be an unreadable carpet; hubs carry the map. */
const LABEL_ZOOM = 2.2;

/**
 * Cluster nodes carry the whole overview on their own, so they are drawn larger and with
 * more contrast between a hub of 4 and a hub of 20 than when they sit among people.
 */
const attrRadius = (size: number, layout: Layout) =>
  layout === "clusters" ? 7 + Math.sqrt(size) * 2.8 : 4 + Math.sqrt(size) * 1.6;

export type Layout = "clusters" | "people";

/**
 * How hard nodes push each other apart, per layout. The cluster overview has ~26 nodes
 * and every one carries a readable label, so it needs more room than the people graph
 * where most nodes are unlabelled dots.
 *
 * `distanceMax` is the part that matters: most clusters have no link at all (a contact has
 * one company, so two companies never share a person), and unbounded repulsion between
 * unlinked nodes has nothing to pull against — they accelerate off-screen until alpha
 * decays. Capping the range makes repulsion local, so the centering force still wins.
 */
const FORCES: Record<Layout, { charge: number; distanceMax: number; linkDistance: number }> = {
  clusters: { charge: -260, distanceMax: 260, linkDistance: 90 },
  people: { charge: -120, distanceMax: 400, linkDistance: 30 },
};

export default function GraphCanvas({
  graphData,
  layout = "people",
  visibleNodeIds,
  highlightIds,
  quietIds,
  onSelectPerson,
  onSelectAttr,
}: {
  graphData: { nodes: GraphNode[]; links: { source: string; target: string }[] };
  /** "clusters" is the overview: attribute nodes only, drawn bigger and spread wider. */
  layout?: Layout;
  visibleNodeIds: Set<string>;
  highlightIds: Set<string>;
  /** Person node ids with no interaction, or none for QUIET_AFTER_DAYS. */
  quietIds: Set<string>;
  onSelectPerson: (contactId: string) => void;
  onSelectAttr: (node: AttrNode) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<ForceGraphMethods | undefined>(undefined);
  const fitted = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 90 people plus their hubs start as one clump in the middle. Fit the view once the
  // simulation settles, and again only when the graph structure actually changed — not
  // after every reheat, which would fight the user's own zoom.
  useEffect(() => {
    fitted.current = false;
  }, [graphData]);

  // The simulation is created by the library, so the forces are tuned through its ref
  // once it exists. Re-run on a data swap: switching layout builds a new simulation.
  useEffect(() => {
    const engineRef = engine.current;
    if (!engineRef) return;

    const { charge, distanceMax, linkDistance } = FORCES[layout];
    engineRef.d3Force("charge")?.strength(charge).distanceMax(distanceMax);
    engineRef.d3Force("link")?.distance(linkDistance);

    // The reheat moves everything, so the view has to be fitted again afterwards —
    // without this the spread-out clusters settle outside the viewport.
    fitted.current = false;
    engineRef.d3ReheatSimulation();
  }, [layout, graphData, size.width, size.height]);

  useEffect(() => {
    const element = box.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const touchesSelection = (link: LinkObject) =>
    highlightIds.has(endId(link.source)) || highlightIds.has(endId(link.target));

  const drawNode = (raw: NodeObject, ctx: CanvasRenderingContext2D, scale: number) => {
    const node = asDatum(raw);
    if (!visibleNodeIds.has(node.id) || node.x === undefined || node.y === undefined) return;

    const t = tokens();
    const hairline = 1 / scale;
    const selected = highlightIds.has(node.id);
    const hovered = node.id === hoveredId;

    if (node.kind === "person") {
      const quiet = quietIds.has(node.id);

      // Meaning, not decoration: no interaction at all, or none for QUIET_AFTER_DAYS.
      // The halo is what keeps a quiet contact readable when the map is zoomed out.
      if (quiet) {
        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, HALO_RADIUS);
        halo.addColorStop(0, withAlpha(t.caution, 0.28));
        halo.addColorStop(1, withAlpha(t.caution, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, HALO_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      const radius = selected ? SELECTED_RADIUS : quiet ? QUIET_RADIUS : hovered ? 4 : PERSON_RADIUS;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = quiet ? t.caution : selected || hovered ? t.foreground : t.person;
      ctx.fill();

      if (selected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, SELECTED_RADIUS + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = t.foreground;
        ctx.lineWidth = 1.5 * hairline;
        ctx.stroke();
      }

      if (selected || hovered || scale > LABEL_ZOOM) {
        ctx.font = `500 ${11 / scale}px ${t.sans}, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = selected || hovered ? t.foreground : t.muted;
        ctx.fillText(node.label, node.x, node.y + radius + 6 / scale);
      }
      return;
    }

    const radius = attrRadius(node.size, layout);
    const hue = t.hub[node.attr];
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = t.background;
    ctx.fill();
    ctx.strokeStyle = hovered ? t.foreground : hue;
    ctx.lineWidth = (hovered ? 2 : 1.5) * hairline;
    ctx.stroke();

    ctx.font = `500 ${11 / scale}px ${t.mono}, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = hovered ? t.foreground : hue;
    ctx.fillText(node.label.toUpperCase(), node.x, node.y + radius + 4 / scale);

    // In the overview the headcount is the whole point of the node, so it is drawn inside.
    if (layout === "clusters") {
      ctx.font = `500 ${11 / scale}px ${t.mono}, monospace`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = t.foreground;
      ctx.fillText(String(node.size), node.x, node.y);
    }
  };

  const paintPointerArea = (raw: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
    const node = asDatum(raw);
    if (!visibleNodeIds.has(node.id) || node.x === undefined || node.y === undefined) return;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.kind === "person" ? 7 : attrRadius(node.size, layout), 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };

  return (
    <div ref={box} className="min-h-[420px] flex-1">
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph2D
          ref={engine}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="transparent"
          nodeId="id"
          // The hovered node's name is drawn on the canvas itself; the library's white
          // tooltip box would duplicate it in a style that is not ours.
          nodeLabel={() => ""}
          nodeVisibility={(node: NodeObject) => visibleNodeIds.has(asDatum(node).id)}
          linkVisibility={(link: LinkObject) =>
            visibleNodeIds.has(endId(link.source)) && visibleNodeIds.has(endId(link.target))
          }
          // The selected person's edges step up, so you can see which hubs they hang on.
          linkColor={(link: LinkObject) => (touchesSelection(link) ? tokens().edgeActive : tokens().edge)}
          linkWidth={(link: LinkObject) => (touchesSelection(link) ? 1 : 0.6)}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintPointerArea}
          onNodeHover={(raw: NodeObject | null) => setHoveredId(raw ? asDatum(raw).id : null)}
          onNodeClick={(raw: NodeObject) => {
            const node = asDatum(raw);
            if (node.kind === "person") onSelectPerson(node.id.slice("person:".length));
            else onSelectAttr(node);
          }}
          cooldownTime={4000}
          d3VelocityDecay={0.35}
          onEngineStop={() => {
            if (fitted.current) return;
            fitted.current = true;
            engine.current?.zoomToFit(400, 72);
          }}
        />
      ) : null}
    </div>
  );
}
