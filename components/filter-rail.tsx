"use client";

/**
 * The controls, as a slim rail beside the graph rather than a panel above it.
 *
 * The old version was five `<select multiple>` boxes in a full-width panel that ate half
 * the viewport before the graph got any. Picking a value is now done by clicking a cluster
 * in the graph itself, so all that is left here is the free-text search, the quiet toggle
 * and which dimensions to draw.
 */
import type { AttrKind, GraphFilter } from "@/lib/core/types";
import { BTN_QUIET, INPUT } from "@/components/primitives";

/** `dot` is the dimension's hue — the same token the canvas rings its hubs with. */
export const DIMENSIONS: { kind: AttrKind; label: string; dot: string }[] = [
  { kind: "company", label: "Company", dot: "bg-hub-company" },
  { kind: "role", label: "Role", dot: "bg-hub-role" },
  { kind: "city", label: "City", dot: "bg-hub-city" },
  { kind: "relation", label: "Relation", dot: "bg-hub-relation" },
  { kind: "tag", label: "Tag", dot: "bg-hub-tag" },
];

export function isFilterActive(filter: GraphFilter): boolean {
  return Boolean(filter.query?.trim()) || Boolean(filter.quietOnly);
}

function Check({
  checked,
  onChange,
  dot,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  dot?: string;
  children: string;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {dot ? <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /> : null}
      {children}
    </label>
  );
}

export default function FilterRail({
  filter,
  onChange,
  dimensions,
  onDimensionsChange,
  visible,
  total,
}: {
  filter: GraphFilter;
  onChange: (next: GraphFilter) => void;
  dimensions: AttrKind[];
  onDimensionsChange: (next: AttrKind[]) => void;
  visible: number;
  total: number;
}) {
  const shown = new Set(dimensions);

  const toggleDimension = (kind: AttrKind, on: boolean) => {
    const next = DIMENSIONS.filter((d) => (d.kind === kind ? on : shown.has(d.kind))).map(
      (d) => d.kind,
    );
    // Turning the last one off would leave an empty canvas with no way back.
    if (next.length) onDimensionsChange(next);
  };

  return (
    <div className="flex shrink-0 flex-col gap-5 border-b border-border p-4 lg:w-[200px] lg:border-b-0 lg:border-r">
      <div>
        <label className="block">
          <span className="label-mono block pb-1.5">Search</span>
          <input
            className={INPUT}
            type="search"
            name="query"
            value={filter.query ?? ""}
            placeholder="Name, company, city"
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
          />
        </label>

        <div className="mt-2">
          <Check
            checked={Boolean(filter.quietOnly)}
            onChange={(next) => onChange({ ...filter, quietOnly: next })}
          >
            Quiet only
          </Check>
        </div>
      </div>

      {/* Wraps into a row on a phone so the graph is not pushed below the fold. */}
      <div className="flex flex-wrap gap-x-5 lg:block">
        <p className="label-mono w-full pb-1">Cluster by</p>
        {DIMENSIONS.map(({ kind, label, dot }) => (
          <Check
            key={kind}
            dot={dot}
            checked={shown.has(kind)}
            onChange={(next) => toggleDimension(kind, next)}
          >
            {label}
          </Check>
        ))}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <p className="label-mono text-foreground">
          {visible} / {total}
        </p>
        {isFilterActive(filter) ? (
          <button
            type="button"
            className={`${BTN_QUIET} mt-1 px-0`}
            onClick={() => onChange({ query: "", quietOnly: false })}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
