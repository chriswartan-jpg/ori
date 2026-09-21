"use client";

/**
 * The mindmap. react-force-graph-2d touches `window`, so it is loaded with ssr: false —
 * only legal inside a Client Component, which this is.
 *
 * Filtering never rebuilds `graphData`: hidden nodes stay in the simulation and are just
 * not drawn (nodeVisibility / linkVisibility). Rebuilding would restart the layout and
 * make the whole map jump on every keystroke.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";

import type { AttrNode, GraphNode } from "@/lib/core/types";

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
let palette: Record<string, string> | null = null;
function tokens() {
  if (!palette) {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    palette = {
      foreground: read("--foreground"),
      muted: read("--muted-foreground"),
      border: read("--border"),
      card: read("--card"),
      caution: read("--caution"),
      // next/font puts the resolved family names in these variables. A canvas font string
      // cannot contain var(), so the value has to be read out here.
      sans: read("--font-inter") || "sans-serif",
      mono: read("--font-jetbrains-mono") || "monospace",
    };
  }
  return palette;
}

const PERSON_RADIUS = 3.2;
const attrRadius = (size: number) => 4 + Math.sqrt(size) * 1.6;

export default function GraphCanvas({
  graphData,
  visibleNodeIds,
  highlightIds,
  quietIds,
  onSelectPerson,
  onSelectAttr,
}: {
  graphData: { nodes: GraphNode[]; links: { source: string; target: string }[] };
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

  // 90 people plus their hubs start as one clump in the middle. Fit the view once the
  // simulation settles, and again only when the graph structure actually changed — not
  // after every reheat, which would fight the user's own zoom.
  useEffect(() => {
    fitted.current = false;
  }, [graphData]);

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

  const drawNode = (raw: NodeObject, ctx: CanvasRenderingContext2D, scale: number) => {
    const node = asDatum(raw);
    if (!visibleNodeIds.has(node.id) || node.x === undefined || node.y === undefined) return;

    const t = tokens();
    const hairline = 1 / scale;
    const highlighted = highlightIds.has(node.id);

    if (node.kind === "person") {
      ctx.beginPath();
      ctx.arc(node.x, node.y, PERSON_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = highlighted ? t.foreground : t.muted;
      ctx.fill();

      // Meaning, not decoration: no interaction at all, or none for QUIET_AFTER_DAYS.
      if (quietIds.has(node.id)) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, PERSON_RADIUS + 2.4, 0, 2 * Math.PI);
        ctx.strokeStyle = t.caution;
        ctx.lineWidth = hairline;
        ctx.stroke();
      }

      if (highlighted || scale > 2.2) {
        ctx.font = `${11 / scale}px ${t.sans}, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = highlighted ? t.foreground : t.muted;
        ctx.fillText(node.label, node.x, node.y + PERSON_RADIUS + 4 / scale);
      }
      return;
    }

    const radius = attrRadius(node.size);
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = t.card;
    ctx.fill();
    ctx.strokeStyle = highlighted ? t.foreground : t.muted;
    ctx.lineWidth = hairline;
    ctx.stroke();

    ctx.font = `${12 / scale}px ${t.mono}, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = t.foreground;
    ctx.fillText(node.label, node.x, node.y + radius + 3 / scale);
  };

  const paintPointerArea = (raw: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
    const node = asDatum(raw);
    if (!visibleNodeIds.has(node.id) || node.x === undefined || node.y === undefined) return;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.kind === "person" ? 6 : attrRadius(node.size), 0, 2 * Math.PI);
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
          nodeLabel={(node: NodeObject) => asDatum(node).label}
          nodeVisibility={(node: NodeObject) => visibleNodeIds.has(asDatum(node).id)}
          linkVisibility={(link: LinkObject) =>
            visibleNodeIds.has(endId(link.source)) && visibleNodeIds.has(endId(link.target))
          }
          linkColor={() => tokens().border}
          linkWidth={0.6}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintPointerArea}
          onNodeClick={(raw: NodeObject) => {
            const node = asDatum(raw);
            if (node.kind === "person") onSelectPerson(node.id.slice("person:".length));
            else onSelectAttr(node);
          }}
          cooldownTime={4000}
          d3VelocityDecay={0.35}
          onEngineStop={() => {
            console.log("ORI engineStop, ref =", engine.current ? "present" : "MISSING");
            if (fitted.current) return;
            fitted.current = true;
            engine.current?.zoomToFit(300, 48);
          }}
        />
      ) : null}
    </div>
  );
}
