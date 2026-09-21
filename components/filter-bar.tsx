"use client";

/**
 * Multi-select without a state library: a native <select multiple>. Keyboard and screen
 * reader support come for free, and a dimension with no values in this network is not
 * rendered at all (no company in Familie).
 */
import type { Facets } from "@/lib/core/graph/filter";
import type { GraphFilter } from "@/lib/core/types";
import { BTN_QUIET, Field, INPUT } from "@/components/primitives";

type Dimension = keyof Facets;

const DIMENSION_LABELS: Record<Dimension, string> = {
  companies: "Firma",
  roles: "Rolle",
  cities: "Stadt",
  relations: "Beziehung",
  tags: "Tags",
};

const DIMENSIONS: Dimension[] = ["companies", "roles", "cities", "relations", "tags"];

export function isFilterActive(filter: GraphFilter): boolean {
  return (
    DIMENSIONS.some((dimension) => (filter[dimension] ?? []).length > 0) ||
    Boolean(filter.query?.trim()) ||
    Boolean(filter.quietOnly)
  );
}

export default function FilterBar({
  facets,
  filter,
  onChange,
  visible,
  total,
}: {
  facets: Facets;
  filter: GraphFilter;
  onChange: (next: GraphFilter) => void;
  visible: number;
  total: number;
}) {
  const active = isFilterActive(filter);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <Field label="Suche">
            <input
              className={INPUT}
              type="search"
              value={filter.query ?? ""}
              placeholder="Name, Firma, Rolle, Stadt, Tag"
              onChange={(event) => onChange({ ...filter, query: event.target.value })}
            />
          </Field>
        </div>

        {DIMENSIONS.filter((dimension) => facets[dimension].length > 0).map((dimension) => (
          <div key={dimension} className="w-[168px]">
            <Field label={DIMENSION_LABELS[dimension]}>
              <select
                className={`${INPUT} h-[92px]`}
                multiple
                value={filter[dimension] ?? []}
                onChange={(event) =>
                  onChange({
                    ...filter,
                    [dimension]: Array.from(event.target.selectedOptions, (option) => option.value),
                  })
                }
              >
                {facets[dimension].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}

        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={Boolean(filter.quietOnly)}
            onChange={(event) => onChange({ ...filter, quietOnly: event.target.checked })}
          />
          Nur stille Kontakte
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
        <span className="label-mono">
          {visible} von {total} sichtbar
        </span>
        {active ? (
          <button
            type="button"
            className={BTN_QUIET}
            onClick={() => onChange({ query: "", quietOnly: false })}
          >
            Filter zurücksetzen
          </button>
        ) : null}
      </div>
    </div>
  );
}
